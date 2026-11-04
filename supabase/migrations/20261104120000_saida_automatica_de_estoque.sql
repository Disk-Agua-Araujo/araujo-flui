-- Saída automática de estoque (novembro de 2026, pedido do Matheus)
--
-- Antes a baixa só acontecia quando o pedido passava por "em rota". Retirada
-- e entrega marcada direto como entregue não tiravam nada do estoque, e o
-- cancelamento não devolvia o que tinha saído. A regra agora é uma só, num
-- gatilho da tabela de pedidos, valendo para qualquer caminho de mudança:
--
--   pedido entra em "em rota" ou "entregue"  -> os itens saem do estoque
--   pedido sai desses status (cancelado etc.) -> o que saiu volta
--   pedido excluído                           -> o que saiu volta
--   itens editados com o pedido já baixado    -> só a diferença sai ou volta
--
-- Falta de estoque trava o pedido, como já era (decisão do Matheus).
-- Produto de atacado pode apontar para o produto de varejo e baixar de lá.

-- ---------------------------------------------------------------------------
-- Cadastro

-- Produto que baixa o estoque de outro (ex.: Carvão 2 kg atacado -> Carvão 2kg).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_stock_product_not_self;
ALTER TABLE public.products
  ADD CONSTRAINT products_stock_product_not_self CHECK (stock_product_id IS DISTINCT FROM id);

-- Pedido que segue a regra nova. Os já entregues ou cancelados antes desta
-- migração ficam de fora: o estoque de hoje já foi contado depois deles, e
-- editar um pedido antigo não pode mexer no saldo.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_tracked boolean NOT NULL DEFAULT true;

UPDATE public.orders o
SET stock_tracked = false
WHERE o.status IN ('entregue', 'cancelado')
   OR (o.status = 'em_rota' AND NOT EXISTS (SELECT 1 FROM public.stock_movements m WHERE m.order_id = o.id));

-- ---------------------------------------------------------------------------
-- Funções de apoio

-- Itens do pedido no formato [{product_id, qty}].
CREATE OR REPLACE FUNCTION public.order_items_json(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('product_id', oi.product_id, 'qty', oi.qty)), '[]'::jsonb)
  FROM order_items oi
  WHERE oi.order_id = p_order_id;
$$;

-- Quantidade por produto que de fato tem o estoque: o atacado vira o produto
-- de varejo. Só entra produto com "Controlar estoque" ligado.
CREATE OR REPLACE FUNCTION public.stock_lines(p_items jsonb)
RETURNS TABLE(line_product uuid, line_qty integer)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT b.id, sum((e->>'qty')::int)::int
  FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
  JOIN products p ON p.id = (e->>'product_id')::uuid
  JOIN products b ON b.id = coalesce(p.stock_product_id, p.id)
  WHERE b.track_stock
  GROUP BY b.id;
$$;

-- Quanto já saiu do estoque por este pedido, por produto (saída menos estorno).
CREATE OR REPLACE FUNCTION public.order_stock_moved(p_order_id uuid)
RETURNS TABLE(moved_product uuid, moved_qty integer)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT m.product_id, sum(CASE m.type WHEN 'out' THEN m.qty WHEN 'in' THEN -m.qty ELSE 0 END)::int
  FROM stock_movements m
  WHERE m.order_id = p_order_id
  GROUP BY m.product_id;
$$;

-- O que uma mudança no pedido faz no estoque: positivo sai, negativo volta.
-- Estorno nunca devolve mais do que saiu por este pedido.
CREATE OR REPLACE FUNCTION public.order_stock_plan(
  p_order_id uuid,
  p_tracked boolean,
  p_old_status order_status,
  p_new_status order_status,
  p_old_items jsonb,
  p_new_items jsonb
)
RETURNS TABLE(item_product uuid, item_delta integer)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_was boolean := p_old_status IN ('em_rota', 'entregue');
  v_is boolean := p_new_status IN ('em_rota', 'entregue');
BEGIN
  IF v_is AND NOT v_was THEN
    RETURN QUERY
      SELECT l.line_product, l.line_qty FROM stock_lines(p_new_items) l WHERE l.line_qty > 0;
  ELSIF v_was AND NOT v_is AND p_tracked THEN
    RETURN QUERY
      SELECT m.moved_product, -m.moved_qty FROM order_stock_moved(p_order_id) m WHERE m.moved_qty > 0;
  ELSIF v_was AND v_is AND p_tracked THEN
    RETURN QUERY
      SELECT x.pid, x.delta FROM (
        SELECT
          coalesce(n.line_product, o.line_product) AS pid,
          CASE
            WHEN coalesce(n.line_qty, 0) >= coalesce(o.line_qty, 0)
              THEN coalesce(n.line_qty, 0) - coalesce(o.line_qty, 0)
            ELSE -least(coalesce(o.line_qty, 0) - coalesce(n.line_qty, 0), greatest(coalesce(m.moved_qty, 0), 0))
          END AS delta
        FROM stock_lines(p_new_items) n
        FULL JOIN stock_lines(p_old_items) o ON o.line_product = n.line_product
        LEFT JOIN order_stock_moved(p_order_id) m ON m.moved_product = coalesce(n.line_product, o.line_product)
      ) x
      WHERE x.delta <> 0;
  END IF;
END;
$$;

-- Movimenta um produto por causa de um pedido. Com p_strict, falta de estoque
-- trava a operação inteira.
CREATE OR REPLACE FUNCTION public.stock_move_for_order(
  p_order_id uuid,
  p_product_id uuid,
  p_delta integer,
  p_by text,
  p_reason text,
  p_strict boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_qty integer;
  v_name text;
BEGIN
  IF p_delta IS NULL OR p_delta = 0 THEN
    RETURN;
  END IF;

  SELECT stock_qty, name INTO v_qty, v_name FROM products WHERE id = p_product_id FOR UPDATE;
  IF p_delta > 0 AND p_strict AND v_qty < p_delta THEN
    RAISE EXCEPTION 'Estoque insuficiente de %: tem % no painel e o pedido precisa de %. Lance a entrada em Produtos > Ajustar estoque.',
      v_name, v_qty, p_delta;
  END IF;

  UPDATE products SET stock_qty = stock_qty - p_delta WHERE id = p_product_id;
  INSERT INTO stock_movements (product_id, type, qty, reason, order_id, created_by)
  VALUES (
    p_product_id,
    (CASE WHEN p_delta > 0 THEN 'out' ELSE 'in' END)::stock_movement_type,
    abs(p_delta),
    p_reason,
    p_order_id,
    p_by
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Gatilhos

-- Mudança de status: baixa ou estorno na mesma transação. Se faltar estoque, o
-- status não muda.
CREATE OR REPLACE FUNCTION public.orders_status_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_by text;
  v_reason text;
  v_items jsonb;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_by := coalesce(nullif(current_setting('app.stock_user', true), ''), NEW.updated_by);
  v_items := order_items_json(NEW.id);

  IF NEW.status IN ('em_rota', 'entregue') AND OLD.status NOT IN ('em_rota', 'entregue') THEN
    -- Pedido antigo reaberto e entregue de novo conta como venda nova.
    NEW.stock_tracked := true;
    v_reason := 'Baixa por pedido';
  ELSIF NEW.status = 'cancelado' THEN
    v_reason := 'Estorno: pedido cancelado';
  ELSE
    v_reason := 'Estorno: pedido voltou para ' || NEW.status::text;
  END IF;

  FOR r IN
    SELECT * FROM order_stock_plan(NEW.id, OLD.stock_tracked, OLD.status, NEW.status, v_items, v_items)
  LOOP
    PERFORM stock_move_for_order(NEW.id, r.item_product, r.item_delta, v_by, v_reason, true);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_status_stock ON public.orders;
CREATE TRIGGER trg_orders_status_stock
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_status_stock();

-- Pedido excluído devolve o que tinha saído. O movimento fica sem pedido
-- (o pedido deixa de existir), com o código dele no motivo.
CREATE OR REPLACE FUNCTION public.orders_delete_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
BEGIN
  IF OLD.stock_tracked THEN
    FOR r IN SELECT * FROM order_stock_moved(OLD.id) WHERE moved_qty > 0 LOOP
      PERFORM stock_move_for_order(
        NULL, r.moved_product, -r.moved_qty,
        nullif(current_setting('app.stock_user', true), ''),
        'Estorno: pedido ' || upper(left(OLD.id::text, 8)) || ' excluído',
        false
      );
    END LOOP;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_delete_stock ON public.orders;
CREATE TRIGGER trg_orders_delete_stock
  BEFORE DELETE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_delete_stock();

-- ---------------------------------------------------------------------------
-- Chamadas da edge function

-- Confere, antes de salvar uma edição, se o estoque cobre o pedido como ele
-- vai ficar. Levanta o mesmo erro do gatilho.
CREATE OR REPLACE FUNCTION public.check_order_stock(
  p_order_id uuid,
  p_new_status order_status DEFAULT NULL,
  p_new_items jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status order_status;
  v_tracked boolean;
  v_items jsonb;
  v_qty integer;
  v_name text;
  r record;
BEGIN
  SELECT status, stock_tracked INTO v_status, v_tracked FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  v_items := order_items_json(p_order_id);

  FOR r IN
    SELECT * FROM order_stock_plan(
      p_order_id, v_tracked, v_status, coalesce(p_new_status, v_status), v_items, coalesce(p_new_items, v_items)
    )
    WHERE item_delta > 0
  LOOP
    SELECT stock_qty, name INTO v_qty, v_name FROM products WHERE id = r.item_product;
    IF v_qty < r.item_delta THEN
      RAISE EXCEPTION 'Estoque insuficiente de %: tem % no painel e o pedido precisa de %. Lance a entrada em Produtos > Ajustar estoque.',
        v_name, v_qty, r.item_delta;
    END IF;
  END LOOP;
END;
$$;

-- Depois de trocar os itens de um pedido já baixado: sai ou volta só a
-- diferença entre os itens antigos (p_old_items) e os de agora.
CREATE OR REPLACE FUNCTION public.apply_order_items_stock(p_order_id uuid, p_old_items jsonb, p_by text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status order_status;
  v_tracked boolean;
  r record;
BEGIN
  SELECT status, stock_tracked INTO v_status, v_tracked FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  FOR r IN
    SELECT * FROM order_stock_plan(p_order_id, v_tracked, v_status, v_status, p_old_items, order_items_json(p_order_id))
  LOOP
    PERFORM stock_move_for_order(p_order_id, r.item_product, r.item_delta, p_by, 'Ajuste: itens do pedido alterados', false);
  END LOOP;
END;
$$;

-- Troca o status de vários pedidos, um por um: a falta de estoque em um não
-- impede os outros. Devolve o resultado de cada pedido.
CREATE OR REPLACE FUNCTION public.set_orders_status(p_order_ids uuid[], p_status order_status, p_created_by text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_results jsonb := '[]'::jsonb;
BEGIN
  PERFORM set_config('app.stock_user', coalesce(p_created_by, ''), true);
  FOREACH v_id IN ARRAY p_order_ids
  LOOP
    BEGIN
      PERFORM 1 FROM orders WHERE id = v_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido não encontrado';
      END IF;
      UPDATE orders SET status = p_status WHERE id = v_id AND status IS DISTINCT FROM p_status;
      v_results := v_results || jsonb_build_object('order_id', v_id, 'ok', true);
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_object('order_id', v_id, 'ok', false, 'error', SQLERRM);
    END;
  END LOOP;
  RETURN v_results;
END;
$$;

-- "Em rota" continua com o mesmo nome; a baixa agora vem do gatilho.
CREATE OR REPLACE FUNCTION public.mark_orders_em_rota(p_order_ids uuid[], p_created_by text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.set_orders_status(p_order_ids, 'em_rota'::order_status, p_created_by);
$$;

-- Só a edge function (service_role) chama. O REVOKE antigo tirava o acesso de
-- anon e authenticated, mas o EXECUTE de PUBLIC continuava, e qualquer um com a
-- chave pública do site conseguia ajustar estoque e pôr pedido em rota. Aqui
-- sai o PUBLIC também, inclusive das funções antigas.
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.order_items_json(uuid)',
    'public.stock_lines(jsonb)',
    'public.order_stock_moved(uuid)',
    'public.order_stock_plan(uuid, boolean, order_status, order_status, jsonb, jsonb)',
    'public.stock_move_for_order(uuid, uuid, integer, text, text, boolean)',
    'public.check_order_stock(uuid, order_status, jsonb)',
    'public.apply_order_items_stock(uuid, jsonb, text)',
    'public.set_orders_status(uuid[], order_status, text)',
    'public.mark_orders_em_rota(uuid[], text)',
    'public.deduct_stock_for_order(uuid, text)',
    'public.adjust_stock(uuid, integer, stock_movement_type, text, text)',
    'public.orders_status_stock()',
    'public.orders_delete_stock()'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END;
$$;

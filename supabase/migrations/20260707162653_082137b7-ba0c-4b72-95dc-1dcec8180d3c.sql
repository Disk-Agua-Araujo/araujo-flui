ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS em_rota_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_em_rota_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'em_rota' AND OLD.status IS DISTINCT FROM 'em_rota' THEN
    NEW.em_rota_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_em_rota_at ON public.orders;
CREATE TRIGGER trg_set_em_rota_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_em_rota_at();

CREATE OR REPLACE FUNCTION public.mark_orders_em_rota(p_order_ids uuid[], p_created_by text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_status order_status;
  v_results jsonb := '[]'::jsonb;
BEGIN
  FOREACH v_id IN ARRAY p_order_ids
  LOOP
    BEGIN
      SELECT status INTO v_status FROM orders WHERE id = v_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido não encontrado';
      END IF;
      IF v_status IS DISTINCT FROM 'em_rota' THEN
        PERFORM deduct_stock_for_order(v_id, p_created_by);
        UPDATE orders SET status = 'em_rota' WHERE id = v_id;
      END IF;
      v_results := v_results || jsonb_build_object('order_id', v_id, 'ok', true);
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_object('order_id', v_id, 'ok', false, 'error', SQLERRM);
    END;
  END LOOP;
  RETURN v_results;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_orders_em_rota FROM anon, authenticated;
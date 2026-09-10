-- Relatório em regime de caixa (setembro de 2026)
--
-- O relatório existente conta o dinheiro na data do pedido. Com pedido a
-- prazo isso deixou de refletir o caixa, então aqui entra a segunda visão:
-- o dinheiro contado no dia em que efetivamente entrou.
--
-- Data de caixa de um pedido:
--   à vista            -> data do pedido (agendamento ou criação)
--   a prazo e recebido -> data do recebimento
--   a prazo em aberto  -> ainda não entrou no caixa, fica de fora

CREATE OR REPLACE FUNCTION public.order_cash_date(
  p_payment_due_date date,
  p_paid_at date,
  p_scheduled_date date,
  p_created_at timestamptz
)
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_payment_due_date IS NULL
      THEN COALESCE(p_scheduled_date, (p_created_at AT TIME ZONE 'America/Sao_Paulo')::date)
    ELSE p_paid_at
  END;
$$;

-- Caixa por forma de pagamento, separando o que veio à vista do que veio a
-- prazo. Segue a mesma regra de pagamento dividido do relatório por pedido.
CREATE OR REPLACE FUNCTION public.get_cash_by_payment_method(
  date_start date,
  date_end date
)
RETURNS TABLE(payment_method text, a_prazo boolean, total numeric, order_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      o.id,
      o.payment_method AS pm1,
      o.payment_method_2 AS pm2,
      o.payment_amount_1,
      o.payment_amount_2,
      o.total_amount,
      o.is_split_payment,
      (o.payment_due_date IS NOT NULL) AS prazo
    FROM orders o
    WHERE o.status <> 'cancelado'
      AND o.payment_method IS NOT NULL
      AND public.order_cash_date(o.payment_due_date, o.paid_at, o.scheduled_date, o.created_at)
          BETWEEN date_start AND date_end
  ),
  expanded AS (
    SELECT b.id, b.prazo, b.pm1 AS pm, COALESCE(b.payment_amount_1, 0) AS amt
    FROM base b WHERE b.is_split_payment = true AND b.pm1 IS NOT NULL
    UNION ALL
    SELECT b.id, b.prazo, b.pm2 AS pm, COALESCE(b.payment_amount_2, 0) AS amt
    FROM base b WHERE b.is_split_payment = true AND b.pm2 IS NOT NULL
    UNION ALL
    SELECT b.id, b.prazo, b.pm1 AS pm, COALESCE(b.total_amount, 0) AS amt
    FROM base b WHERE b.is_split_payment = false
  )
  SELECT
    e.pm,
    e.prazo,
    COALESCE(SUM(e.amt), 0),
    COUNT(DISTINCT e.id)::bigint
  FROM expanded e
  GROUP BY e.pm, e.prazo;
$$;

-- Lançamentos do caixa no período, com busca por cliente (nome ou telefone).
-- total_count vem junto para paginar sem uma segunda consulta.
CREATE OR REPLACE FUNCTION public.get_cash_entries(
  date_start date,
  date_end date,
  search text DEFAULT NULL,
  row_limit integer DEFAULT 50,
  row_offset integer DEFAULT 0
)
RETURNS TABLE(
  order_id uuid,
  cash_date date,
  customer_name text,
  customer_phone text,
  payment_method text,
  payment_method_2 text,
  is_split boolean,
  total_amount numeric,
  a_prazo boolean,
  due_date date,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      o.id,
      public.order_cash_date(o.payment_due_date, o.paid_at, o.scheduled_date, o.created_at) AS d_caixa,
      c.name AS nome,
      c.phone AS telefone,
      o.payment_method AS pm1,
      o.payment_method_2 AS pm2,
      o.is_split_payment AS dividido,
      o.total_amount AS valor,
      (o.payment_due_date IS NOT NULL) AS prazo,
      o.payment_due_date AS vencimento
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.status <> 'cancelado'
      AND o.payment_method IS NOT NULL
  ),
  filtered AS (
    SELECT b.*
    FROM base b
    WHERE b.d_caixa BETWEEN date_start AND date_end
      AND (
        search IS NULL
        OR search = ''
        OR b.nome ILIKE '%' || search || '%'
        OR b.telefone ILIKE '%' || search || '%'
      )
  )
  SELECT
    f.id,
    f.d_caixa,
    f.nome,
    f.telefone,
    f.pm1,
    f.pm2,
    f.dividido,
    f.valor,
    f.prazo,
    f.vencimento,
    COUNT(*) OVER ()::bigint
  FROM filtered f
  ORDER BY f.d_caixa DESC, f.nome NULLS LAST
  LIMIT row_limit OFFSET row_offset;
$$;

REVOKE ALL ON FUNCTION public.get_cash_by_payment_method(date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_cash_entries(date, date, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_by_payment_method(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cash_entries(date, date, text, integer, integer) TO service_role;

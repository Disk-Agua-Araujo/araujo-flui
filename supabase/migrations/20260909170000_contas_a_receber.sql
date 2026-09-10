-- Contas a receber (setembro de 2026)
--
-- Pedido a prazo: o cliente recebe a mercadoria hoje e paga numa data
-- combinada. O pedido segue seu fluxo normal de entrega; o dinheiro só
-- entra no caixa no dia em que o pagamento for registrado.
--
-- payment_due_date preenchido  = pedido a prazo, vira conta a receber.
-- paid_at preenchido           = recebido nessa data (regime de caixa).
-- paid_by                      = quem deu a baixa, para auditoria.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_due_date date;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at date;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_by text;

-- Contas ainda em aberto, ordenadas por vencimento.
CREATE INDEX IF NOT EXISTS orders_receivables_open_idx
  ON public.orders (payment_due_date)
  WHERE payment_due_date IS NOT NULL AND paid_at IS NULL;

-- Contas já recebidas, para o total recebido no período.
CREATE INDEX IF NOT EXISTS orders_receivables_paid_idx
  ON public.orders (paid_at)
  WHERE paid_at IS NOT NULL;

-- Totais da aba Contas a receber. Agregado em SQL para não esbarrar no
-- limite de linhas da API REST quando houver muita conta em aberto.
-- "Hoje" é sempre o dia de São Paulo, não o do servidor.
-- Quando search vem preenchido, os totais acompanham a busca por cliente.
CREATE OR REPLACE FUNCTION public.get_receivables_summary(
  date_start date DEFAULT NULL,
  date_end date DEFAULT NULL,
  search text DEFAULT NULL
)
RETURNS TABLE(
  open_total numeric,
  open_count bigint,
  due_today_total numeric,
  due_today_count bigint,
  late_total numeric,
  late_count bigint,
  received_total numeric,
  received_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH hoje AS (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS d),
  base AS (
    SELECT o.total_amount, o.payment_due_date, o.paid_at
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.payment_due_date IS NOT NULL
      AND o.status <> 'cancelado'
      AND (
        search IS NULL
        OR search = ''
        OR c.name ILIKE '%' || search || '%'
        OR c.phone ILIKE '%' || search || '%'
      )
  )
  SELECT
    COALESCE(SUM(b.total_amount) FILTER (WHERE b.paid_at IS NULL), 0),
    COUNT(*) FILTER (WHERE b.paid_at IS NULL),
    COALESCE(SUM(b.total_amount) FILTER (WHERE b.paid_at IS NULL AND b.payment_due_date = h.d), 0),
    COUNT(*) FILTER (WHERE b.paid_at IS NULL AND b.payment_due_date = h.d),
    COALESCE(SUM(b.total_amount) FILTER (WHERE b.paid_at IS NULL AND b.payment_due_date < h.d), 0),
    COUNT(*) FILTER (WHERE b.paid_at IS NULL AND b.payment_due_date < h.d),
    COALESCE(SUM(b.total_amount) FILTER (
      WHERE b.paid_at IS NOT NULL
        AND (date_start IS NULL OR b.paid_at >= date_start)
        AND (date_end IS NULL OR b.paid_at <= date_end)
    ), 0),
    COUNT(*) FILTER (
      WHERE b.paid_at IS NOT NULL
        AND (date_start IS NULL OR b.paid_at >= date_start)
        AND (date_end IS NULL OR b.paid_at <= date_end)
    )
  FROM base b
  CROSS JOIN hoje h;
$$;

REVOKE ALL ON FUNCTION public.get_receivables_summary(date, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_receivables_summary(date, date, text) TO service_role;

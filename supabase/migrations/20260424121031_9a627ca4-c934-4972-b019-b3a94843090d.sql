-- Resumo agregado de pedidos por período
CREATE OR REPLACE FUNCTION public.get_orders_summary(
  date_start date,
  date_end date
)
RETURNS TABLE(
  total_orders bigint,
  delivered bigint,
  cancelled bigint,
  total_items bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT id, status
    FROM orders
    WHERE COALESCE(scheduled_date, (created_at AT TIME ZONE 'America/Sao_Paulo')::date) BETWEEN date_start AND date_end
  )
  SELECT
    (SELECT COUNT(*) FROM filtered)::bigint AS total_orders,
    (SELECT COUNT(*) FROM filtered WHERE status = 'entregue')::bigint AS delivered,
    (SELECT COUNT(*) FROM filtered WHERE status = 'cancelado')::bigint AS cancelled,
    COALESCE((
      SELECT SUM(oi.qty)
      FROM order_items oi
      JOIN filtered f ON f.id = oi.order_id
      WHERE f.status <> 'cancelado'
    ), 0)::bigint AS total_items;
$$;

-- Faturamento por forma de pagamento
CREATE OR REPLACE FUNCTION public.get_revenue_by_payment_method(
  date_start date,
  date_end date
)
RETURNS TABLE(payment_method text, total numeric, order_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    payment_method,
    COALESCE(SUM(total_amount), 0) AS total,
    COUNT(*)::bigint AS order_count
  FROM orders
  WHERE
    COALESCE(scheduled_date, (created_at AT TIME ZONE 'America/Sao_Paulo')::date) BETWEEN date_start AND date_end
    AND status <> 'cancelado'
    AND payment_method IS NOT NULL
  GROUP BY payment_method;
$$;

-- Vendas por produto no período
CREATE OR REPLACE FUNCTION public.get_sales_by_product(
  date_start date,
  date_end date
)
RETURNS TABLE(product_name text, qty bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.name AS product_name,
    SUM(oi.qty)::bigint AS qty
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  JOIN orders o ON o.id = oi.order_id
  WHERE
    COALESCE(o.scheduled_date, (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date) BETWEEN date_start AND date_end
    AND o.status <> 'cancelado'
  GROUP BY p.name
  ORDER BY qty DESC;
$$;

-- Restringir execução das RPCs ao service_role (chamadas do edge function admin-panel)
REVOKE ALL ON FUNCTION public.get_orders_summary(date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_revenue_by_payment_method(date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_sales_by_product(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_orders_summary(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_revenue_by_payment_method(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_sales_by_product(date, date) TO service_role;
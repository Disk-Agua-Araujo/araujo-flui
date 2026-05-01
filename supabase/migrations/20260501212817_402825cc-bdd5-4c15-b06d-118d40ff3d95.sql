-- Add split payment columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method_2 text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_amount_1 numeric(10,2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_amount_2 numeric(10,2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS change_for_2 numeric(10,2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_split_payment boolean NOT NULL DEFAULT false;

-- Validation via trigger (CHECK with subselect-like logic kept simple here)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_method_2_valid'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_payment_method_2_valid
      CHECK (payment_method_2 IS NULL OR payment_method_2 IN ('cash','pix','card'));
  END IF;
END$$;

-- Update revenue RPC to account for split payments
CREATE OR REPLACE FUNCTION public.get_revenue_by_payment_method(date_start date, date_end date)
 RETURNS TABLE(payment_method text, total numeric, order_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      o.id,
      o.payment_method,
      o.payment_method_2,
      o.payment_amount_1,
      o.payment_amount_2,
      o.total_amount,
      o.is_split_payment
    FROM orders o
    WHERE
      COALESCE(o.scheduled_date, (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date) BETWEEN date_start AND date_end
      AND o.status <> 'cancelado'
      AND o.payment_method IS NOT NULL
  ),
  expanded AS (
    -- Method 1 (split payments): use payment_amount_1
    SELECT id, payment_method AS pm,
           COALESCE(payment_amount_1, 0) AS amt
    FROM base WHERE is_split_payment = true AND payment_method IS NOT NULL
    UNION ALL
    -- Method 2 (split payments)
    SELECT id, payment_method_2 AS pm,
           COALESCE(payment_amount_2, 0) AS amt
    FROM base WHERE is_split_payment = true AND payment_method_2 IS NOT NULL
    UNION ALL
    -- Simple payments (use full total)
    SELECT id, payment_method AS pm,
           COALESCE(total_amount, 0) AS amt
    FROM base WHERE is_split_payment = false
  )
  SELECT pm AS payment_method,
         COALESCE(SUM(amt), 0) AS total,
         COUNT(DISTINCT id)::bigint AS order_count
  FROM expanded
  GROUP BY pm;
$function$;
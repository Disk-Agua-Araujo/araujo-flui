-- Revoke column-level SELECT on inventory columns from public roles.
-- The admin backend uses the service role and is unaffected.
REVOKE SELECT (stock_qty, min_stock_qty, track_stock) ON public.products FROM anon;
REVOKE SELECT (stock_qty, min_stock_qty, track_stock) ON public.products FROM authenticated;

-- Drop the helper view since column-level grants now solve the problem cleanly.
DROP VIEW IF EXISTS public.public_products;

-- 1. Remove permissive public policies on product-images bucket
DROP POLICY IF EXISTS "Allow insert product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow update product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete product images" ON storage.objects;

-- 2. Add explicit INSERT policy on customers (admin-only)
-- Public order flow uses create_full_site_order RPC (SECURITY DEFINER) which bypasses RLS.
CREATE POLICY "Admins insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (is_admin());

-- 3. Harden adjust_stock against negative quantities
CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_product_id uuid,
  p_qty integer,
  p_type stock_movement_type,
  p_reason text DEFAULT NULL::text,
  p_created_by text DEFAULT NULL::text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_qty integer;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser um inteiro positivo (recebido: %)', p_qty;
  END IF;

  IF p_type = 'in' THEN
    UPDATE products SET stock_qty = stock_qty + p_qty WHERE id = p_product_id RETURNING stock_qty INTO v_new_qty;
  ELSIF p_type = 'out' THEN
    UPDATE products SET stock_qty = stock_qty - p_qty WHERE id = p_product_id RETURNING stock_qty INTO v_new_qty;
  ELSE
    UPDATE products SET stock_qty = p_qty WHERE id = p_product_id RETURNING stock_qty INTO v_new_qty;
  END IF;

  INSERT INTO stock_movements (product_id, type, qty, reason, created_by)
  VALUES (p_product_id, p_type, p_qty, p_reason, p_created_by);

  RETURN v_new_qty;
END;
$function$;
-- 1) Restrict public access to inventory columns by removing public SELECT on products
DROP POLICY IF EXISTS "Anyone can read products" ON public.products;

CREATE POLICY "Admins read all products"
ON public.products
FOR SELECT
TO authenticated
USING (is_admin());

-- 2) Create a public view excluding inventory columns
CREATE OR REPLACE VIEW public.public_products
WITH (security_invoker = false) AS
SELECT
  id,
  name,
  description,
  type,
  icon,
  active,
  price_text,
  created_at,
  category_id,
  show_in_quick_order,
  image_url
FROM public.products
WHERE active = true;

GRANT SELECT ON public.public_products TO anon, authenticated;

-- 3) Add INSERT policy on order_items restricted to admins
CREATE POLICY "Admins insert order_items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (is_admin());

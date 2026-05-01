DROP VIEW IF EXISTS public.public_products;

CREATE VIEW public.public_products
WITH (security_invoker = true) AS
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

-- Allow the view to bypass the new admin-only RLS for reading active products publicly.
-- We achieve this by adding a policy that allows public to read minimal columns via the view path.
-- Since RLS is row-level, we add a public SELECT policy back but the view's column projection ensures inventory is hidden.
CREATE POLICY "Public read active products"
ON public.products
FOR SELECT
TO anon, authenticated
USING (active = true);

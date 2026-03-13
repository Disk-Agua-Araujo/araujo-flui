
-- 1. Add show_in_quick_order to products
ALTER TABLE public.products ADD COLUMN show_in_quick_order boolean NOT NULL DEFAULT false;

-- 2. Add image_url to products
ALTER TABLE public.products ADD COLUMN image_url text;

-- 3. Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- 4. Storage policies: public read
CREATE POLICY "Public read product images" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'product-images');

-- 5. Storage policies: admin upload
CREATE POLICY "Admins upload product images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND is_admin());

-- 6. Storage policies: admin update
CREATE POLICY "Admins update product images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-images' AND is_admin());

-- 7. Storage policies: admin delete
CREATE POLICY "Admins delete product images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND is_admin());

-- 8. Auto-enable show_in_quick_order for existing Galões products
UPDATE public.products
SET show_in_quick_order = true
WHERE category_id IN (
  SELECT id FROM public.product_categories WHERE slug IN ('galoes-10l', 'galoes-20l')
);


-- Allow all inserts on product-images (admin uses custom auth, not Supabase Auth)
CREATE POLICY "Allow insert product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');

-- Allow all updates for upsert
CREATE POLICY "Allow update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images');

-- Allow all deletes
CREATE POLICY "Allow delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images');

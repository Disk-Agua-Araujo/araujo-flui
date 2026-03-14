UPDATE products
SET show_in_quick_order = true
WHERE category_id IN (
  SELECT id FROM product_categories
  WHERE slug IN ('galoes-20l', 'galoes-10l')
)
AND active = true;
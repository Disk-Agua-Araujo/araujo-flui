
-- 1. Create product_categories table
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  sort_order int DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- Public can read categories
CREATE POLICY "Anyone can read categories" ON public.product_categories
  FOR SELECT TO public USING (true);

-- Admins can insert categories
CREATE POLICY "Admins insert categories" ON public.product_categories
  FOR INSERT TO authenticated WITH CHECK (is_admin());

-- Admins can update categories
CREATE POLICY "Admins update categories" ON public.product_categories
  FOR UPDATE TO authenticated USING (is_admin());

-- Admins can delete categories
CREATE POLICY "Admins delete categories" ON public.product_categories
  FOR DELETE TO authenticated USING (is_admin());

-- 2. Seed categories
INSERT INTO public.product_categories (name, slug, sort_order) VALUES
  ('Fardos', 'fardos', 1),
  ('Galões de 10L', 'galoes-10l', 2),
  ('Galões de 20L', 'galoes-20l', 3),
  ('Refrigerantes', 'refrigerantes', 4),
  ('Sucos', 'sucos', 5),
  ('Acessórios', 'acessorios', 6);

-- 3. Add category_id to products
ALTER TABLE public.products ADD COLUMN category_id uuid REFERENCES public.product_categories(id);

-- 4. Add payment_method to orders
ALTER TABLE public.orders ADD COLUMN payment_method text;

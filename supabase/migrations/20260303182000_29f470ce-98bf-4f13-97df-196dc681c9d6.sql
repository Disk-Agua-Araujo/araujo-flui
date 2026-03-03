
-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE public.customer_type AS ENUM ('PF', 'PJ');
CREATE TYPE public.order_channel AS ENUM ('site', 'whatsapp', 'ligacao', 'admin');
CREATE TYPE public.order_status AS ENUM ('novo', 'agendado', 'em_rota', 'entregue', 'cancelado');
CREATE TYPE public.product_type AS ENUM ('varejo', 'atacado', 'ambos');
CREATE TYPE public.app_role AS ENUM ('admin_owner', 'admin_manager');

-- ============================================================
-- TABLES
-- ============================================================

-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type customer_type NOT NULL DEFAULT 'PF',
  name TEXT NOT NULL,
  cnpj TEXT,
  phone TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Addresses
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Santo André',
  state TEXT NOT NULL DEFAULT 'SP',
  zip TEXT,
  complement TEXT,
  reference TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type product_type NOT NULL DEFAULT 'varejo',
  icon TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  price_text TEXT DEFAULT 'Consulte no WhatsApp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wholesale price tiers
CREATE TABLE public.wholesale_price_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  min_qty INTEGER NOT NULL,
  price_text TEXT NOT NULL DEFAULT 'Consulte'
);

-- Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel order_channel NOT NULL DEFAULT 'site',
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  address_id UUID NOT NULL REFERENCES public.addresses(id) ON DELETE CASCADE,
  delivery_date DATE,
  delivery_time TEXT,
  status order_status NOT NULL DEFAULT 'novo',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Order items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 1
);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin_owner', 'admin_manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin_owner'
  )
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- customers
CREATE POLICY "Anyone can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins select all customers" ON public.customers FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Users select own customers" ON public.customers FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Admins update customers" ON public.customers FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins delete customers" ON public.customers FOR DELETE TO authenticated USING (public.is_admin());
-- Allow anon insert for public orders
CREATE POLICY "Anon can insert customers" ON public.customers FOR INSERT TO anon WITH CHECK (true);

-- addresses
CREATE POLICY "Anyone can insert addresses" ON public.addresses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins select all addresses" ON public.addresses FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Users select own addresses" ON public.addresses FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.customers WHERE id = addresses.customer_id AND created_by = auth.uid())
);
CREATE POLICY "Admins update addresses" ON public.addresses FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins delete addresses" ON public.addresses FOR DELETE TO authenticated USING (public.is_admin());
CREATE POLICY "Anon can insert addresses" ON public.addresses FOR INSERT TO anon WITH CHECK (true);

-- products (public read)
CREATE POLICY "Anyone can read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update products" ON public.products FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins delete products" ON public.products FOR DELETE TO authenticated USING (public.is_admin());

-- wholesale_price_tiers (public read)
CREATE POLICY "Anyone can read tiers" ON public.wholesale_price_tiers FOR SELECT USING (true);
CREATE POLICY "Admins insert tiers" ON public.wholesale_price_tiers FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update tiers" ON public.wholesale_price_tiers FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins delete tiers" ON public.wholesale_price_tiers FOR DELETE TO authenticated USING (public.is_admin());

-- orders
CREATE POLICY "Anyone can insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anon can insert orders" ON public.orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Admins select all orders" ON public.orders FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Users select own orders" ON public.orders FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins delete orders" ON public.orders FOR DELETE TO authenticated USING (public.is_admin());

-- order_items
CREATE POLICY "Anyone can insert order_items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anon can insert order_items" ON public.order_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Admins select all order_items" ON public.order_items FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Users select own order_items" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_items.order_id AND created_by = auth.uid())
);
CREATE POLICY "Admins update order_items" ON public.order_items FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins delete order_items" ON public.order_items FOR DELETE TO authenticated USING (public.is_admin());

-- user_roles
CREATE POLICY "Admins select roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin() OR user_id = auth.uid());
CREATE POLICY "Owners insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin_owner());
CREATE POLICY "Owners update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin_owner());
CREATE POLICY "Owners delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin_owner());

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_delivery_date ON public.orders(delivery_date);
CREATE INDEX idx_orders_channel ON public.orders(channel);
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_addresses_customer_id ON public.addresses(customer_id);
CREATE INDEX idx_products_type ON public.products(type);
CREATE INDEX idx_products_active ON public.products(active);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

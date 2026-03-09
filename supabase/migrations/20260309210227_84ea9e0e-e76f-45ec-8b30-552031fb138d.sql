
-- =============================================
-- Fix: Convert ALL 32 RESTRICTIVE policies to PERMISSIVE
-- =============================================

-- === PRODUCTS (5 policies) ===
DROP POLICY IF EXISTS "Admins delete products" ON public.products;
DROP POLICY IF EXISTS "Admins insert products" ON public.products;
DROP POLICY IF EXISTS "Admins update products" ON public.products;
DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
DROP POLICY IF EXISTS "Admins select all order_items" ON public.products;

CREATE POLICY "Admins delete products" ON public.products FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admins insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins update products" ON public.products FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Anyone can read products" ON public.products FOR SELECT TO public USING (true);

-- === WHOLESALE_PRICE_TIERS (4 policies) ===
DROP POLICY IF EXISTS "Admins delete tiers" ON public.wholesale_price_tiers;
DROP POLICY IF EXISTS "Admins insert tiers" ON public.wholesale_price_tiers;
DROP POLICY IF EXISTS "Admins update tiers" ON public.wholesale_price_tiers;
DROP POLICY IF EXISTS "Anyone can read tiers" ON public.wholesale_price_tiers;

CREATE POLICY "Admins delete tiers" ON public.wholesale_price_tiers FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admins insert tiers" ON public.wholesale_price_tiers FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins update tiers" ON public.wholesale_price_tiers FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Anyone can read tiers" ON public.wholesale_price_tiers FOR SELECT TO public USING (true);

-- === ADDRESSES (4 policies) ===
DROP POLICY IF EXISTS "Admins delete addresses" ON public.addresses;
DROP POLICY IF EXISTS "Admins select all addresses" ON public.addresses;
DROP POLICY IF EXISTS "Admins update addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users select own addresses" ON public.addresses;

CREATE POLICY "Admins delete addresses" ON public.addresses FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admins select all addresses" ON public.addresses FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins update addresses" ON public.addresses FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Users select own addresses" ON public.addresses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = addresses.customer_id AND customers.created_by = auth.uid()));

-- === ADMIN_USERS (1 policy) ===
DROP POLICY IF EXISTS "Owners manage admin_users" ON public.admin_users;

CREATE POLICY "Owners manage admin_users" ON public.admin_users FOR ALL TO authenticated USING (is_admin_owner()) WITH CHECK (is_admin_owner());

-- === CUSTOMERS (4 policies) ===
DROP POLICY IF EXISTS "Admins delete customers" ON public.customers;
DROP POLICY IF EXISTS "Admins select all customers" ON public.customers;
DROP POLICY IF EXISTS "Admins update customers" ON public.customers;
DROP POLICY IF EXISTS "Users select own customers" ON public.customers;

CREATE POLICY "Admins delete customers" ON public.customers FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admins select all customers" ON public.customers FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins update customers" ON public.customers FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Users select own customers" ON public.customers FOR SELECT TO authenticated USING (created_by = auth.uid());

-- === ORDER_ITEMS (4 policies) ===
DROP POLICY IF EXISTS "Admins delete order_items" ON public.order_items;
DROP POLICY IF EXISTS "Admins select all order_items" ON public.order_items;
DROP POLICY IF EXISTS "Admins update order_items" ON public.order_items;
DROP POLICY IF EXISTS "Users select own order_items" ON public.order_items;

CREATE POLICY "Admins delete order_items" ON public.order_items FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admins select all order_items" ON public.order_items FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins update order_items" ON public.order_items FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Users select own order_items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.created_by = auth.uid()));

-- === ORDERS (4 policies) ===
DROP POLICY IF EXISTS "Admins delete orders" ON public.orders;
DROP POLICY IF EXISTS "Admins select all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins update orders" ON public.orders;
DROP POLICY IF EXISTS "Users select own orders" ON public.orders;

CREATE POLICY "Admins delete orders" ON public.orders FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admins select all orders" ON public.orders FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Users select own orders" ON public.orders FOR SELECT TO authenticated USING (created_by = auth.uid());

-- === STOCK_MOVEMENTS (3 policies) ===
DROP POLICY IF EXISTS "Admins delete stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Admins insert stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Admins select stock_movements" ON public.stock_movements;

CREATE POLICY "Admins delete stock_movements" ON public.stock_movements FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admins insert stock_movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins select stock_movements" ON public.stock_movements FOR SELECT TO authenticated USING (is_admin());

-- === USER_ROLES (4 policies) ===
DROP POLICY IF EXISTS "Admins select roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners update roles" ON public.user_roles;

CREATE POLICY "Admins select roles" ON public.user_roles FOR SELECT TO authenticated USING (is_admin() OR (user_id = auth.uid()));
CREATE POLICY "Owners delete roles" ON public.user_roles FOR DELETE TO authenticated USING (is_admin_owner());
CREATE POLICY "Owners insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (is_admin_owner());
CREATE POLICY "Owners update roles" ON public.user_roles FOR UPDATE TO authenticated USING (is_admin_owner());


-- =============================================
-- 1. Convert ALL restrictive policies to permissive
-- =============================================

-- PRODUCTS
DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
CREATE POLICY "Anyone can read products" ON public.products FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins insert products" ON public.products;
CREATE POLICY "Admins insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins update products" ON public.products;
CREATE POLICY "Admins update products" ON public.products FOR UPDATE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Admins delete products" ON public.products;
CREATE POLICY "Admins delete products" ON public.products FOR DELETE TO authenticated USING (is_admin());

-- CUSTOMERS
DROP POLICY IF EXISTS "Admins select all customers" ON public.customers;
CREATE POLICY "Admins select all customers" ON public.customers FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Users select own customers" ON public.customers;
CREATE POLICY "Users select own customers" ON public.customers FOR SELECT TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Admins update customers" ON public.customers;
CREATE POLICY "Admins update customers" ON public.customers FOR UPDATE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Admins delete customers" ON public.customers;
CREATE POLICY "Admins delete customers" ON public.customers FOR DELETE TO authenticated USING (is_admin());

-- ADDRESSES
DROP POLICY IF EXISTS "Admins select all addresses" ON public.addresses;
CREATE POLICY "Admins select all addresses" ON public.addresses FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Users select own addresses" ON public.addresses;
CREATE POLICY "Users select own addresses" ON public.addresses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = addresses.customer_id AND customers.created_by = auth.uid()));

DROP POLICY IF EXISTS "Admins update addresses" ON public.addresses;
CREATE POLICY "Admins update addresses" ON public.addresses FOR UPDATE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Admins delete addresses" ON public.addresses;
CREATE POLICY "Admins delete addresses" ON public.addresses FOR DELETE TO authenticated USING (is_admin());

-- ORDERS
DROP POLICY IF EXISTS "Admins select all orders" ON public.orders;
CREATE POLICY "Admins select all orders" ON public.orders FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Users select own orders" ON public.orders;
CREATE POLICY "Users select own orders" ON public.orders FOR SELECT TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Admins update orders" ON public.orders;
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Admins delete orders" ON public.orders;
CREATE POLICY "Admins delete orders" ON public.orders FOR DELETE TO authenticated USING (is_admin());

-- ORDER_ITEMS
DROP POLICY IF EXISTS "Admins select all order_items" ON public.order_items;
CREATE POLICY "Admins select all order_items" ON public.order_items FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Users select own order_items" ON public.order_items;
CREATE POLICY "Users select own order_items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.created_by = auth.uid()));

DROP POLICY IF EXISTS "Admins update order_items" ON public.order_items;
CREATE POLICY "Admins update order_items" ON public.order_items FOR UPDATE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Admins delete order_items" ON public.order_items;
CREATE POLICY "Admins delete order_items" ON public.order_items FOR DELETE TO authenticated USING (is_admin());

-- STOCK_MOVEMENTS
DROP POLICY IF EXISTS "Admins select stock_movements" ON public.stock_movements;
CREATE POLICY "Admins select stock_movements" ON public.stock_movements FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Admins insert stock_movements" ON public.stock_movements;
CREATE POLICY "Admins insert stock_movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins delete stock_movements" ON public.stock_movements;
CREATE POLICY "Admins delete stock_movements" ON public.stock_movements FOR DELETE TO authenticated USING (is_admin());

-- USER_ROLES
DROP POLICY IF EXISTS "Admins select roles" ON public.user_roles;
CREATE POLICY "Admins select roles" ON public.user_roles FOR SELECT TO authenticated USING (is_admin() OR (user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners insert roles" ON public.user_roles;
CREATE POLICY "Owners insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (is_admin_owner());

DROP POLICY IF EXISTS "Owners update roles" ON public.user_roles;
CREATE POLICY "Owners update roles" ON public.user_roles FOR UPDATE TO authenticated USING (is_admin_owner());

DROP POLICY IF EXISTS "Owners delete roles" ON public.user_roles;
CREATE POLICY "Owners delete roles" ON public.user_roles FOR DELETE TO authenticated USING (is_admin_owner());

-- ADMIN_USERS
DROP POLICY IF EXISTS "Owners manage admin_users" ON public.admin_users;
CREATE POLICY "Owners manage admin_users" ON public.admin_users FOR ALL TO authenticated USING (is_admin_owner()) WITH CHECK (is_admin_owner());

-- WHOLESALE_PRICE_TIERS
DROP POLICY IF EXISTS "Anyone can read tiers" ON public.wholesale_price_tiers;
CREATE POLICY "Anyone can read tiers" ON public.wholesale_price_tiers FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins insert tiers" ON public.wholesale_price_tiers;
CREATE POLICY "Admins insert tiers" ON public.wholesale_price_tiers FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins update tiers" ON public.wholesale_price_tiers;
CREATE POLICY "Admins update tiers" ON public.wholesale_price_tiers FOR UPDATE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Admins delete tiers" ON public.wholesale_price_tiers;
CREATE POLICY "Admins delete tiers" ON public.wholesale_price_tiers FOR DELETE TO authenticated USING (is_admin());

-- =============================================
-- 2. Add RLS policies to login_attempts (admin-only)
-- =============================================
CREATE POLICY "Admins select login_attempts" ON public.login_attempts FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins delete login_attempts" ON public.login_attempts FOR DELETE TO authenticated USING (is_admin());

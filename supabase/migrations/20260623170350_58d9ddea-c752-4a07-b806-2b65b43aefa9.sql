
-- 1) addresses: add scoped INSERT policies
CREATE POLICY "Admins insert addresses" ON public.addresses
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "Users insert own addresses" ON public.addresses
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = addresses.customer_id
      AND customers.created_by = auth.uid()
  ));

-- 2) orders: add INSERT policies (admins + user-scoped)
CREATE POLICY "Admins insert orders" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "Users insert own orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- order_items: add user-scoped INSERT (admin policy already exists)
CREATE POLICY "Users insert own order_items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
      AND orders.created_by = auth.uid()
  ));

-- 3) products: hide internal stock fields from anon/authenticated via column-level grants
-- Admin reads/writes go through the admin-panel edge function using the service_role, which bypasses RLS and column grants.
REVOKE SELECT ON public.products FROM anon, authenticated;
GRANT SELECT (id, name, description, type, icon, active, price_text, created_at, category_id, show_in_quick_order, image_url)
  ON public.products TO anon, authenticated;

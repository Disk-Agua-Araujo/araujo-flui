-- Restrict delivery_riders SELECT to admins (admin-panel uses service_role and bypasses RLS)
DROP POLICY IF EXISTS "Anyone can read riders" ON public.delivery_riders;

CREATE POLICY "Admins read riders"
ON public.delivery_riders FOR SELECT
TO authenticated
USING (is_admin());

-- Allow admins to update stock_movements (corrections to audit log)
CREATE POLICY "Admins update stock_movements"
ON public.stock_movements FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());
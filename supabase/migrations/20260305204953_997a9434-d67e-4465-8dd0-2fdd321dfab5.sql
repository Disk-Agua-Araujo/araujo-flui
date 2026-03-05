-- 1) Tabela de administradores para governança do painel
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  username text NOT NULL UNIQUE,
  role public.app_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage admin_users" ON public.admin_users;
CREATE POLICY "Owners manage admin_users"
ON public.admin_users
FOR ALL
TO authenticated
USING (public.is_admin_owner())
WITH CHECK (public.is_admin_owner());

DROP TRIGGER IF EXISTS set_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER set_admin_users_updated_at
BEFORE UPDATE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Remover políticas públicas de escrita sensível; pedidos públicos seguem via função SECURITY DEFINER create_full_site_order
DROP POLICY IF EXISTS "Anon can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can insert customers" ON public.customers;

DROP POLICY IF EXISTS "Anon can insert addresses" ON public.addresses;
DROP POLICY IF EXISTS "Anyone can insert addresses" ON public.addresses;

DROP POLICY IF EXISTS "Anon can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;

DROP POLICY IF EXISTS "Anon can insert order_items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can insert order_items" ON public.order_items;

-- 3) Garantir que o fluxo público continue autorizado via RPC
GRANT EXECUTE ON FUNCTION public.create_full_site_order(text, text, public.customer_type, text, text, text, text, text, text, text, text, text, date, text, jsonb) TO anon, authenticated;
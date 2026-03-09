
CREATE TABLE IF NOT EXISTS public.geocode_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_ip text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT geocode_rate_limits_ip_unique UNIQUE (client_ip)
);

ALTER TABLE public.geocode_rate_limits ENABLE ROW LEVEL SECURITY;

-- Admin-only access, service_role used by edge function
CREATE POLICY "Admins select geocode_rate_limits" ON public.geocode_rate_limits FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins delete geocode_rate_limits" ON public.geocode_rate_limits FOR DELETE TO authenticated USING (is_admin());

-- Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_geocode_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.geocode_rate_limits WHERE window_start < now() - interval '2 minutes';
$$;

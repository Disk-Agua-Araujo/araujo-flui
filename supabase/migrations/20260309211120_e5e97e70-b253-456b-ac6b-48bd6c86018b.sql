
-- Persistent rate limiting table for admin login
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_key text NOT NULL,
  failed_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS login_attempts_key_idx ON public.login_attempts (attempt_key);

-- Auto-cleanup old records (older than 1 day)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.login_attempts WHERE last_attempt_at < now() - interval '1 day';
$$;

-- RLS: only service_role can access this table
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
-- No permissive policies = no access via anon/authenticated, only service_role

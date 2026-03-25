ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT null;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_by text DEFAULT null;
ALTER TABLE public.orders ADD COLUMN pix_paid boolean DEFAULT false;
ALTER TABLE public.orders ADD COLUMN pix_paid_at timestamp with time zone DEFAULT null;
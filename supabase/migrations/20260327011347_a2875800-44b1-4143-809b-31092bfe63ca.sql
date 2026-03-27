
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS scheduled_time text,
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_dismissed boolean NOT NULL DEFAULT false;

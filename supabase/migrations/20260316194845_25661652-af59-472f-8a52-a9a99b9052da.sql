-- Task 1: Allow addresses without customer (for delivery-only orders without phone)
ALTER TABLE public.addresses ALTER COLUMN customer_id DROP NOT NULL;

-- Task 3: Add payment amount columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount decimal(10,2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS change_for decimal(10,2);
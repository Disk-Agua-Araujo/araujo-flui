CREATE INDEX IF NOT EXISTS idx_addresses_street ON public.addresses (street);
CREATE INDEX IF NOT EXISTS idx_addresses_customer_id ON public.addresses (customer_id);
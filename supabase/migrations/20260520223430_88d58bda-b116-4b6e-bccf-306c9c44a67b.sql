CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_date ON public.orders (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON public.orders (rider_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
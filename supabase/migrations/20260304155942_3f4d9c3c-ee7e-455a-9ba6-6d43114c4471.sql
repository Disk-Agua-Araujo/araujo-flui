
-- Add stock fields to products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS stock_qty integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_stock_qty integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT false;

-- Create stock movement type enum
DO $$ BEGIN
  CREATE TYPE public.stock_movement_type AS ENUM ('in', 'out', 'adjust');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create stock_movements table
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type stock_movement_type NOT NULL,
  qty integer NOT NULL,
  reason text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins select stock_movements" ON public.stock_movements FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins insert stock_movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins delete stock_movements" ON public.stock_movements FOR DELETE TO authenticated USING (is_admin());

-- Function to create full site order (atomic, bypasses RLS for anon inserts)
CREATE OR REPLACE FUNCTION public.create_full_site_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_type customer_type DEFAULT 'PF',
  p_customer_cnpj text DEFAULT NULL,
  p_street text DEFAULT '',
  p_number text DEFAULT '',
  p_neighborhood text DEFAULT '',
  p_city text DEFAULT 'Santo André',
  p_state text DEFAULT 'SP',
  p_complement text DEFAULT NULL,
  p_zip text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_delivery_date date DEFAULT NULL,
  p_delivery_time text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id uuid;
  v_address_id uuid;
  v_order_id uuid;
  v_item jsonb;
BEGIN
  -- Find or create customer (dedupe by phone + type)
  SELECT id INTO v_customer_id FROM customers 
  WHERE phone = p_customer_phone AND type = p_customer_type LIMIT 1;
  
  IF v_customer_id IS NULL THEN
    INSERT INTO customers (name, phone, type, cnpj)
    VALUES (p_customer_name, p_customer_phone, p_customer_type, p_customer_cnpj)
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE customers SET name = p_customer_name WHERE id = v_customer_id;
  END IF;

  -- Create address
  INSERT INTO addresses (customer_id, street, number, neighborhood, city, state, complement, zip)
  VALUES (v_customer_id, p_street, p_number, p_neighborhood, p_city, p_state, p_complement, p_zip)
  RETURNING id INTO v_address_id;

  -- Create order
  INSERT INTO orders (customer_id, address_id, channel, notes, delivery_date, delivery_time, status)
  VALUES (v_customer_id, v_address_id, 'site', p_notes, p_delivery_date, p_delivery_time, 'novo')
  RETURNING id INTO v_order_id;

  -- Create order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (order_id, product_id, qty)
    VALUES (v_order_id, (v_item->>'product_id')::uuid, (v_item->>'qty')::integer);
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id, 'customer_id', v_customer_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_full_site_order TO anon, authenticated;

-- Function to deduct stock when order is confirmed
CREATE OR REPLACE FUNCTION public.deduct_stock_for_order(p_order_id uuid, p_created_by text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Check all items have sufficient stock
  FOR v_item IN
    SELECT oi.product_id, oi.qty, p.stock_qty, p.track_stock, p.name
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id AND p.track_stock = true
  LOOP
    IF v_item.stock_qty < v_item.qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para %: disponível %, solicitado %', v_item.name, v_item.stock_qty, v_item.qty;
    END IF;
  END LOOP;

  -- Deduct stock and create movements
  FOR v_item IN
    SELECT oi.product_id, oi.qty
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id AND p.track_stock = true
  LOOP
    UPDATE products SET stock_qty = stock_qty - v_item.qty WHERE id = v_item.product_id;
    INSERT INTO stock_movements (product_id, type, qty, reason, order_id, created_by)
    VALUES (v_item.product_id, 'out', v_item.qty, 'Baixa por pedido', p_order_id, p_created_by);
  END LOOP;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_stock_for_order TO authenticated;

-- Function to adjust stock manually
CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_product_id uuid, p_qty integer, p_type stock_movement_type, p_reason text DEFAULT NULL, p_created_by text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_qty integer;
BEGIN
  IF p_type = 'in' THEN
    UPDATE products SET stock_qty = stock_qty + p_qty WHERE id = p_product_id RETURNING stock_qty INTO v_new_qty;
  ELSIF p_type = 'out' THEN
    UPDATE products SET stock_qty = stock_qty - p_qty WHERE id = p_product_id RETURNING stock_qty INTO v_new_qty;
  ELSE
    UPDATE products SET stock_qty = p_qty WHERE id = p_product_id RETURNING stock_qty INTO v_new_qty;
  END IF;

  INSERT INTO stock_movements (product_id, type, qty, reason, created_by)
  VALUES (p_product_id, p_type, p_qty, p_reason, p_created_by);

  RETURN v_new_qty;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_stock TO authenticated;


CREATE OR REPLACE FUNCTION public.create_full_site_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_type customer_type DEFAULT 'PF'::customer_type,
  p_customer_cnpj text DEFAULT NULL::text,
  p_street text DEFAULT ''::text,
  p_number text DEFAULT ''::text,
  p_neighborhood text DEFAULT ''::text,
  p_city text DEFAULT 'Santo André'::text,
  p_state text DEFAULT 'SP'::text,
  p_complement text DEFAULT NULL::text,
  p_zip text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_delivery_date date DEFAULT NULL::date,
  p_delivery_time text DEFAULT NULL::text,
  p_items jsonb DEFAULT '[]'::jsonb
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
  v_product_id uuid;
  v_qty integer;
  v_recent_count integer;
BEGIN
  -- Rate limit: max 3 orders per phone per 5 minutes
  SELECT count(*) INTO v_recent_count
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  WHERE c.phone = p_customer_phone
    AND o.created_at > now() - interval '5 minutes';

  IF v_recent_count >= 3 THEN
    RAISE EXCEPTION 'Muitos pedidos em sequência. Aguarde alguns minutos e tente novamente.';
  END IF;

  -- Input validation: string lengths
  IF length(p_customer_name) > 200 THEN
    RAISE EXCEPTION 'Nome do cliente muito longo (max 200 caracteres)';
  END IF;
  IF length(p_customer_phone) > 30 THEN
    RAISE EXCEPTION 'Telefone muito longo (max 30 caracteres)';
  END IF;
  IF p_customer_cnpj IS NOT NULL AND length(p_customer_cnpj) > 20 THEN
    RAISE EXCEPTION 'CNPJ muito longo (max 20 caracteres)';
  END IF;
  IF length(p_street) > 300 THEN
    RAISE EXCEPTION 'Rua muito longa (max 300 caracteres)';
  END IF;
  IF length(p_number) > 20 THEN
    RAISE EXCEPTION 'Número muito longo (max 20 caracteres)';
  END IF;
  IF length(p_neighborhood) > 200 THEN
    RAISE EXCEPTION 'Bairro muito longo (max 200 caracteres)';
  END IF;
  IF p_notes IS NOT NULL AND length(p_notes) > 2000 THEN
    RAISE EXCEPTION 'Observações muito longas (max 2000 caracteres)';
  END IF;
  IF p_complement IS NOT NULL AND length(p_complement) > 300 THEN
    RAISE EXCEPTION 'Complemento muito longo (max 300 caracteres)';
  END IF;

  -- Input validation: items array
  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' THEN
    RAISE EXCEPTION 'Lista de itens inválida';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Pedido deve conter pelo menos um item';
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Máximo de 50 itens por pedido';
  END IF;

  -- Validate each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'qty')::integer;

    IF v_qty IS NULL OR v_qty <= 0 OR v_qty > 1000 THEN
      RAISE EXCEPTION 'Quantidade inválida (deve ser entre 1 e 1000)';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM products WHERE id = v_product_id AND active = true) THEN
      RAISE EXCEPTION 'Produto não encontrado ou inativo';
    END IF;
  END LOOP;

  -- Find or create customer (dedupe by phone + type)
  SELECT id INTO v_customer_id FROM customers 
  WHERE phone = p_customer_phone AND type = p_customer_type LIMIT 1;
  
  IF v_customer_id IS NULL THEN
    INSERT INTO customers (name, phone, type, cnpj)
    VALUES (p_customer_name, p_customer_phone, p_customer_type, p_customer_cnpj)
    RETURNING id INTO v_customer_id;
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

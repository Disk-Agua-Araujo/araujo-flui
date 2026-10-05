-- Modelos de preço: o mesmo produto tem preço de Porta, Entrega, Shopping e
-- Empresa. O pedido guarda o modelo usado e o cliente tem um modelo padrão.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_porta numeric(10,2) CHECK (price_porta >= 0),
  ADD COLUMN IF NOT EXISTS price_entrega numeric(10,2) CHECK (price_entrega >= 0),
  ADD COLUMN IF NOT EXISTS price_shopping numeric(10,2) CHECK (price_shopping >= 0),
  ADD COLUMN IF NOT EXISTS price_empresa numeric(10,2) CHECK (price_empresa >= 0);

-- O preço de hoje é o de entrega (é o que o site mostra). Os outros três
-- começam vazios para o Disk preencher: nenhum preço é inventado.
UPDATE public.products SET price_entrega = price WHERE price_entrega IS NULL AND price IS NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS price_model text CHECK (price_model IN ('porta', 'entrega', 'shopping', 'empresa'));

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS price_model text CHECK (price_model IN ('porta', 'entrega', 'shopping', 'empresa'));

-- Item sem preço informado nasce com o preço do modelo do pedido. Pedido sem
-- modelo (o do site) usa o de entrega. Modelo sem preço cadastrado fica sem
-- preço, em vez de cair silenciosamente no preço de outro modelo.
CREATE OR REPLACE FUNCTION public.order_items_default_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.unit_price IS NULL THEN
    SELECT CASE o.price_model
             WHEN 'porta' THEN p.price_porta
             WHEN 'shopping' THEN p.price_shopping
             WHEN 'empresa' THEN p.price_empresa
             ELSE COALESCE(p.price_entrega, p.price)
           END
      INTO NEW.unit_price
      FROM public.products p
      LEFT JOIN public.orders o ON o.id = NEW.order_id
     WHERE p.id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Base para a emissão de NF-e: preço numérico do produto, preço do item no
-- momento da venda e os dados fiscais de cliente, endereço e produto.
-- Tudo opcional e aditivo: o site e os pedidos antigos seguem iguais.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price numeric(10,2) CHECK (price >= 0),
  ADD COLUMN IF NOT EXISTS ncm text,
  ADD COLUMN IF NOT EXISTS cest text,
  ADD COLUMN IF NOT EXISTS cfop text,
  ADD COLUMN IF NOT EXISTS cst_csosn text,
  ADD COLUMN IF NOT EXISTS origem smallint NOT NULL DEFAULT 0 CHECK (origem BETWEEN 0 AND 8),
  ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT 'UN';

-- price_text continua sendo o que o site exibe. Quando ele é um valor
-- ("2,50", "16"), vira o preço numérico; "Consulte no WhatsApp" fica sem preço.
UPDATE public.products
SET price = replace(trim(price_text), ',', '.')::numeric
WHERE price IS NULL AND trim(price_text) ~ '^\d+(,\d{1,2})?$';

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_price numeric(10,2) CHECK (unit_price >= 0);

-- Item novo sem preço informado nasce com o preço atual do produto. Cobre o
-- pedido do site (create_full_site_order) sem precisar mexer na RPC.
CREATE OR REPLACE FUNCTION public.order_items_default_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.unit_price IS NULL THEN
    SELECT p.price INTO NEW.unit_price FROM public.products p WHERE p.id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_items_default_price ON public.order_items;
CREATE TRIGGER order_items_default_price
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_items_default_price();

-- ie_indicator segue a NF-e: 1 contribuinte, 2 isento, 9 não contribuinte.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS ie text,
  ADD COLUMN IF NOT EXISTS ie_indicator smallint CHECK (ie_indicator IN (1, 2, 9));

-- Código IBGE do município, exigido no endereço do destinatário da NF-e.
ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS ibge_code text;

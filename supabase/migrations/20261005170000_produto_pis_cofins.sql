-- CST de PIS/COFINS do produto, exigido na NF-e quando o produto não usa grupo
-- tributário da Brasil NFe. Um campo só: na prática os dois CSTs são iguais.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pis_cofins_cst text;

-- Razão social (vai na NF-e; o nome do cadastro segue sendo o fantasia que a
-- equipe usa no dia a dia) e observações do cliente (vasilhame emprestado,
-- combinado de fechamento, "enviar NF-e em toda compra").
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS notes text;

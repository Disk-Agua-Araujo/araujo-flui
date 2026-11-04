-- Entradas e saídas de dinheiro (novembro de 2026, pedido do Matheus)
--
-- Balanço do Disk: o que entrou pelas vendas (regime de caixa, o mesmo do
-- relatório Caixa) contra os gastos lançados à mão (fornecedor, combustível,
-- salário, aluguel...). Entrada avulsa, fora dos pedidos, também é lançada aqui.

CREATE TABLE IF NOT EXISTS public.cash_flow_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('entrada', 'saida')),
  -- Lista de categorias fica na edge function (FINANCE_CATEGORIES).
  category text NOT NULL,
  description text,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  entry_date date NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cash_flow_entries_date_idx ON public.cash_flow_entries (entry_date);

-- Só a edge function (service_role) lê e escreve.
ALTER TABLE public.cash_flow_entries ENABLE ROW LEVEL SECURITY;

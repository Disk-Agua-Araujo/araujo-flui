-- Nota agrupada (novembro de 2026, pedido do Matheus)
--
-- Vários pedidos de um cliente (ex.: os do mês da Rua Bresser) saem numa NF-e
-- só. Os pedidos continuam como estão: relatório, caixa e contas a receber não
-- mudam. O agrupamento só junta os itens na hora de emitir, e pedido agrupado
-- não emite nota própria.

CREATE TABLE IF NOT EXISTS public.invoice_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Destinatário da nota.
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  -- Endereço que sai na nota; vazio usa o principal do cliente.
  address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Agrupamento desfeito que já tinha nota (recusada ou cancelada): fica como
  -- histórico da nota, sem pedidos.
  dissolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.invoice_group_orders (
  group_id uuid NOT NULL REFERENCES public.invoice_groups(id) ON DELETE CASCADE,
  -- Um pedido entra em um agrupamento só.
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  PRIMARY KEY (group_id, order_id)
);

-- A nota passa a ser de um pedido ou de um agrupamento.
ALTER TABLE public.invoices ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.invoice_groups(id) ON DELETE RESTRICT;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_order_or_group;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_order_or_group CHECK ((order_id IS NULL) <> (group_id IS NULL));

CREATE INDEX IF NOT EXISTS invoices_group_id_idx ON public.invoices (group_id);

-- Mesma trava do pedido: uma nota viva por agrupamento e ambiente.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_active_per_group
  ON public.invoices (group_id, environment)
  WHERE status IN ('processando', 'autorizada');

-- Só a edge function (service_role) lê e escreve.
ALTER TABLE public.invoice_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_group_orders ENABLE ROW LEVEL SECURITY;

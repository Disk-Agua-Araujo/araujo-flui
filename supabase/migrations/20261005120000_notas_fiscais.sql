-- Notas fiscais (NF-e) emitidas pela Brasil NFe a partir dos pedidos.
-- Uma linha por tentativa de emissão: as recusadas ficam como histórico.

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  -- Igual ao TipoAmbiente da SEFAZ: 1 produção, 2 homologação (teste, sem valor fiscal).
  environment smallint NOT NULL CHECK (environment IN (1, 2)),
  status text NOT NULL CHECK (status IN ('processando', 'autorizada', 'erro', 'cancelada')),
  numero integer,
  serie integer,
  chave text,
  protocolo text,
  sefaz_code integer,
  -- Motivo da recusa ou aviso, já em texto para mostrar no painel.
  message text,
  total numeric(10,2),
  -- XML autorizado. Fica no banco para entrar no backup diário (guarda de 5 anos).
  xml text,
  -- Última carta de correção enviada (a SEFAZ numera em sequência).
  correction_seq integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  authorized_at timestamptz,
  cancelled_at timestamptz
);

CREATE INDEX IF NOT EXISTS invoices_order_id_idx ON public.invoices (order_id);

-- No máximo uma nota viva (processando ou autorizada) por pedido e ambiente:
-- impede emitir duas vezes o mesmo pedido com dois cliques.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_active_per_order
  ON public.invoices (order_id, environment)
  WHERE status IN ('processando', 'autorizada');

-- Só a edge function (service_role) lê e escreve.
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Grupo tributário cadastrado no painel da Brasil NFe (CodTributacao). Quando
-- preenchido, CFOP, CST, ICMS, PIS e COFINS do item vêm do grupo.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tax_group text;

-- Colunas que existiam no banco de produção (Lovable Cloud) mas nunca
-- entraram nas migrações. Adicionadas aqui para a migração ao Supabase
-- próprio (julho de 2026). Idempotente: no banco antigo elas já existem.

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

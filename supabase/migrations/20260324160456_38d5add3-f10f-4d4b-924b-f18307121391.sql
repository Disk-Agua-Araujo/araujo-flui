
-- Create delivery_riders table
CREATE TABLE public.delivery_riders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_riders ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Anyone can read riders" ON public.delivery_riders FOR SELECT USING (true);

-- Admin manage
CREATE POLICY "Admins insert riders" ON public.delivery_riders FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins update riders" ON public.delivery_riders FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins delete riders" ON public.delivery_riders FOR DELETE TO authenticated USING (is_admin());

-- Add rider_id to orders
ALTER TABLE public.orders ADD COLUMN rider_id uuid REFERENCES public.delivery_riders(id);

-- Seed initial motoboys
INSERT INTO public.delivery_riders (label, name, sort_order) VALUES ('L', 'Lucas', 0), ('M', 'Matheus', 1);

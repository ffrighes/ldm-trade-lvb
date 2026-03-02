
-- Fix function search path
CREATE OR REPLACE FUNCTION public.generate_solicitacao_numero()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero := 'SOL-' || LPAD(nextval('public.solicitacao_numero_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

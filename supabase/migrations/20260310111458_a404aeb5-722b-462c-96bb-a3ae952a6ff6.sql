
-- Inventory table: stores items transferred from finalized solicitações
CREATE TABLE public.inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materials(id),
  descricao text NOT NULL,
  bitola text NOT NULL,
  unidade text NOT NULL DEFAULT 'un',
  quantidade numeric NOT NULL DEFAULT 0,
  custo_unitario numeric NOT NULL DEFAULT 0,
  custo_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on inventario" ON public.inventario
  FOR ALL TO public
  USING (true) WITH CHECK (true);

-- Trigger function: when solicitacao status changes to 'Finalizada', copy items to inventario
CREATE OR REPLACE FUNCTION public.transfer_items_to_inventario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'Finalizada' AND OLD.status IS DISTINCT FROM 'Finalizada' THEN
    INSERT INTO public.inventario (projeto_id, solicitacao_id, material_id, descricao, bitola, unidade, quantidade, custo_unitario, custo_total)
    SELECT NEW.projeto_id, NEW.id, si.material_id, si.descricao, si.bitola, si.unidade, si.quantidade, si.custo_unitario, si.custo_total
    FROM public.solicitacao_itens si
    WHERE si.solicitacao_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transfer_inventario
  AFTER UPDATE ON public.solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.transfer_items_to_inventario();

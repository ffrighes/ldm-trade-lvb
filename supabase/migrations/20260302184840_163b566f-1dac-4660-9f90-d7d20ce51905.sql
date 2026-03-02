
-- Create materials table
CREATE TABLE public.materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  bitola TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'un',
  custo NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (descricao, bitola)
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  data_criacao DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create solicitacoes table
CREATE TABLE public.solicitacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  projeto_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Aberta' CHECK (status IN ('Aberta', 'Aprovada', 'Finalizada')),
  motivo TEXT NOT NULL,
  data_solicitacao DATE NOT NULL DEFAULT CURRENT_DATE,
  desenho TEXT,
  revisao TEXT NOT NULL DEFAULT '',
  erp TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create solicitacao_itens table
CREATE TABLE public.solicitacao_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitacao_id UUID NOT NULL REFERENCES public.solicitacoes(id) ON DELETE CASCADE,
  material_id UUID REFERENCES public.materials(id),
  descricao TEXT NOT NULL,
  bitola TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  unidade TEXT NOT NULL DEFAULT 'un',
  custo_unitario NUMERIC NOT NULL DEFAULT 0,
  custo_total NUMERIC NOT NULL DEFAULT 0
);

-- Enable RLS on all tables
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacao_itens ENABLE ROW LEVEL SECURITY;

-- Permissive policies (no auth required for this app)
CREATE POLICY "Allow all on materials" ON public.materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on solicitacoes" ON public.solicitacoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on solicitacao_itens" ON public.solicitacao_itens FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_materials_descricao ON public.materials(descricao);
CREATE INDEX idx_solicitacoes_projeto ON public.solicitacoes(projeto_id);
CREATE INDEX idx_solicitacao_itens_solicitacao ON public.solicitacao_itens(solicitacao_id);

-- Sequence for solicitacao numbering
CREATE SEQUENCE public.solicitacao_numero_seq START 1;

-- Function to auto-generate solicitacao number
CREATE OR REPLACE FUNCTION public.generate_solicitacao_numero()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero := 'SOL-' || LPAD(nextval('public.solicitacao_numero_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_solicitacao_numero
  BEFORE INSERT ON public.solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_solicitacao_numero();

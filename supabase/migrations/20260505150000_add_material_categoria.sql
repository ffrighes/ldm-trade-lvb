-- Add categoria column to materials, grouping families into broader categories.
ALTER TABLE public.materials
  ADD COLUMN categoria TEXT
  CHECK (categoria IN ('Tubulação', 'Conexões', 'Válvulas', 'Fixadores', 'Instrumentos'));

CREATE INDEX IF NOT EXISTS idx_materials_categoria ON public.materials(categoria);

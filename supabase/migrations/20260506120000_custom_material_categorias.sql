-- Allow custom material categories.
-- 1. Drop the CHECK constraint that hard-coded the 5 original categories.
-- 2. Create a `material_categorias` table to store the (now editable) catalog.
-- 3. Seed it with the original five categories plus any additional values
--    already present in `materials.categoria`.

ALTER TABLE public.materials
  DROP CONSTRAINT IF EXISTS materials_categoria_check;

CREATE TABLE IF NOT EXISTS public.material_categorias (
  nome TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.material_categorias (nome) VALUES
  ('Tubulação'),
  ('Conexões'),
  ('Válvulas'),
  ('Fixadores'),
  ('Instrumentos')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.material_categorias (nome)
SELECT DISTINCT categoria FROM public.materials
WHERE categoria IS NOT NULL
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public.material_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read material_categorias" ON public.material_categorias;
CREATE POLICY "Authenticated can read material_categorias"
ON public.material_categorias FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Privileged can insert material_categorias" ON public.material_categorias;
CREATE POLICY "Privileged can insert material_categorias"
ON public.material_categorias FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'projetista')
);

DROP POLICY IF EXISTS "Privileged can update material_categorias" ON public.material_categorias;
CREATE POLICY "Privileged can update material_categorias"
ON public.material_categorias FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'projetista')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'projetista')
);

DROP POLICY IF EXISTS "Privileged can delete material_categorias" ON public.material_categorias;
CREATE POLICY "Privileged can delete material_categorias"
ON public.material_categorias FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'projetista')
);

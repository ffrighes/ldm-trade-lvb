-- Tabela de fornecedores: cadastro mestre de empresas fornecedoras.
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL UNIQUE,
  observacoes   TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Tabela de histórico de cotações de preços por fornecedor e material.
-- Cada linha é uma cotação pontual; o preço vigente é a mais recente por (fornecedor_id, material_id).
CREATE TABLE IF NOT EXISTS public.fornecedor_precos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id      UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  material_id        UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  codigo_fornecedor  TEXT NOT NULL DEFAULT '',
  valor_unitario     NUMERIC(14,4) NOT NULL CHECK (valor_unitario >= 0),
  moeda              TEXT NOT NULL DEFAULT 'BRL' CHECK (moeda IN ('BRL','USD','EUR')),
  moq                NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (moq >= 0),
  lead_time_dias     INTEGER NOT NULL DEFAULT 0 CHECK (lead_time_dias >= 0),
  desconto_pct       NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (desconto_pct BETWEEN 0 AND 100),
  ipi_pct            NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (ipi_pct BETWEEN 0 AND 100),
  icms_pct           NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (icms_pct BETWEEN 0 AND 100),
  data_cotacao       DATE NOT NULL DEFAULT CURRENT_DATE,
  notas              TEXT NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fornecedor_precos_fornecedor ON public.fornecedor_precos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_fornecedor_precos_material ON public.fornecedor_precos(material_id);
CREATE INDEX IF NOT EXISTS idx_fornecedor_precos_lookup ON public.fornecedor_precos(fornecedor_id, material_id, data_cotacao DESC);

-- RLS fornecedores
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read fornecedores" ON public.fornecedores;
CREATE POLICY "Authenticated can read fornecedores"
ON public.fornecedores FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Privileged can insert fornecedores" ON public.fornecedores;
CREATE POLICY "Privileged can insert fornecedores"
ON public.fornecedores FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'comprador')
);

DROP POLICY IF EXISTS "Privileged can update fornecedores" ON public.fornecedores;
CREATE POLICY "Privileged can update fornecedores"
ON public.fornecedores FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'comprador')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'comprador')
);

DROP POLICY IF EXISTS "Privileged can delete fornecedores" ON public.fornecedores;
CREATE POLICY "Privileged can delete fornecedores"
ON public.fornecedores FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'comprador')
);

-- RLS fornecedor_precos
ALTER TABLE public.fornecedor_precos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read fornecedor_precos" ON public.fornecedor_precos;
CREATE POLICY "Authenticated can read fornecedor_precos"
ON public.fornecedor_precos FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Privileged can insert fornecedor_precos" ON public.fornecedor_precos;
CREATE POLICY "Privileged can insert fornecedor_precos"
ON public.fornecedor_precos FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'comprador')
);

DROP POLICY IF EXISTS "Privileged can update fornecedor_precos" ON public.fornecedor_precos;
CREATE POLICY "Privileged can update fornecedor_precos"
ON public.fornecedor_precos FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'comprador')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'comprador')
);

DROP POLICY IF EXISTS "Privileged can delete fornecedor_precos" ON public.fornecedor_precos;
CREATE POLICY "Privileged can delete fornecedor_precos"
ON public.fornecedor_precos FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'comprador')
);

-- =============================================================
-- Migration: Orçamentos (cotações de fornecedor)
-- =============================================================
-- Substitui o "Módulo de Orçamentos" dormente (project-escopado,
-- multi-fornecedor, cópia de BOM) que nunca teve frontend, por um
-- recurso de cotação de fornecedor standalone, global (/orcamentos).
-- O fornecedor é vinculado à tabela mestre public.fornecedores.
-- =============================================================

-- ---------------------------------------------------------------
-- 1. Remover o módulo dormente (sem uso / sem UI)
-- ---------------------------------------------------------------
DROP FUNCTION IF EXISTS public.copy_bom_to_orcamento(UUID, UUID);
DROP TABLE IF EXISTS public.orcamento_item_cotacoes CASCADE;
DROP TABLE IF EXISTS public.orcamento_fornecedores CASCADE;
DROP TABLE IF EXISTS public.orcamento_itens CASCADE;
DROP TABLE IF EXISTS public.orcamentos CASCADE;
DROP SEQUENCE IF EXISTS public.orcamento_numero_seq;
DROP FUNCTION IF EXISTS public.orcamento_set_numero();

-- ---------------------------------------------------------------
-- 2. Tabela principal: orcamentos (cabeçalho)
-- ---------------------------------------------------------------
CREATE TABLE public.orcamentos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id  UUID        NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  data_orcamento DATE,
  notas          TEXT,
  created_by     UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- 3. Tabela de linhas: orcamento_itens
-- ---------------------------------------------------------------
-- Premissa de impostos "POR DENTRO" (embutidos no preço com impostos):
--   t   = (icms_pct + pis_cofins_pct + ipi_pct) / 100
--   líq = preco_unit_com_impostos * (1 - t)
-- Esta é a leitura direta de "valor com impostos -> líquido" e difere da
-- mecânica estrita de NF-e (IPI "por fora"). A mesma fórmula é centralizada
-- em src/lib/orcamentoCalc.ts. Para alternar para "por fora", trocar a coluna
-- gerada por: preco_unit_com_impostos / (1 + t).
CREATE TABLE public.orcamento_itens (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id             UUID          NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  material_id              UUID          REFERENCES public.materials(id) ON DELETE SET NULL,
  quantidade               NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (quantidade >= 0),
  preco_unit_com_impostos  NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (preco_unit_com_impostos >= 0),
  icms_pct                 NUMERIC(6,3)  NOT NULL DEFAULT 0 CHECK (icms_pct       BETWEEN 0 AND 100),
  pis_cofins_pct           NUMERIC(6,3)  NOT NULL DEFAULT 0 CHECK (pis_cofins_pct BETWEEN 0 AND 100),
  ipi_pct                  NUMERIC(6,3)  NOT NULL DEFAULT 0 CHECK (ipi_pct        BETWEEN 0 AND 100),
  notas                    TEXT,
  position                 INTEGER       NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- Coluna gerada — fonte única da fórmula no banco (premissa "por dentro").
  preco_unit_liquido       NUMERIC(14,4)
    GENERATED ALWAYS AS (preco_unit_com_impostos * (1 - (icms_pct + pis_cofins_pct + ipi_pct) / 100)) STORED
);

-- ---------------------------------------------------------------
-- 4. Índices
-- ---------------------------------------------------------------
CREATE INDEX idx_orcamentos_fornecedor    ON public.orcamentos(fornecedor_id);
CREATE INDEX idx_orcamento_itens_orc      ON public.orcamento_itens(orcamento_id);
CREATE INDEX idx_orcamento_itens_material ON public.orcamento_itens(material_id);

-- ---------------------------------------------------------------
-- 5. Trigger de updated_at (reutiliza o padrão *_touch_updated_at)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.orcamento_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orcamento_updated_at ON public.orcamentos;
CREATE TRIGGER trg_orcamento_updated_at
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.orcamento_touch_updated_at();

DROP TRIGGER IF EXISTS trg_orcamento_item_updated_at ON public.orcamento_itens;
CREATE TRIGGER trg_orcamento_item_updated_at
  BEFORE UPDATE ON public.orcamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.orcamento_touch_updated_at();

-- ---------------------------------------------------------------
-- 6. RLS — orcamentos (espelha materials: leitura authenticated;
--    escrita admin/gerente/projetista = canManageOrcamentos)
-- ---------------------------------------------------------------
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read orcamentos" ON public.orcamentos;
CREATE POLICY "Authenticated can read orcamentos"
  ON public.orcamentos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Privileged can insert orcamentos" ON public.orcamentos;
CREATE POLICY "Privileged can insert orcamentos"
  ON public.orcamentos FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'projetista')
  );

DROP POLICY IF EXISTS "Privileged can update orcamentos" ON public.orcamentos;
CREATE POLICY "Privileged can update orcamentos"
  ON public.orcamentos FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "Admin/Gerente can delete orcamentos" ON public.orcamentos;
CREATE POLICY "Admin/Gerente can delete orcamentos"
  ON public.orcamentos FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
  );

-- ---------------------------------------------------------------
-- 7. RLS — orcamento_itens (mesmo modelo)
-- ---------------------------------------------------------------
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read orcamento_itens" ON public.orcamento_itens;
CREATE POLICY "Authenticated can read orcamento_itens"
  ON public.orcamento_itens FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Privileged can insert orcamento_itens" ON public.orcamento_itens;
CREATE POLICY "Privileged can insert orcamento_itens"
  ON public.orcamento_itens FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'projetista')
  );

DROP POLICY IF EXISTS "Privileged can update orcamento_itens" ON public.orcamento_itens;
CREATE POLICY "Privileged can update orcamento_itens"
  ON public.orcamento_itens FOR UPDATE TO authenticated
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

-- Editores podem remover linhas do orçamento que estão editando.
DROP POLICY IF EXISTS "Admin/Gerente can delete orcamento_itens" ON public.orcamento_itens;
DROP POLICY IF EXISTS "Privileged can delete orcamento_itens" ON public.orcamento_itens;
CREATE POLICY "Privileged can delete orcamento_itens"
  ON public.orcamento_itens FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'projetista')
  );

-- ---------------------------------------------------------------
-- 8. fornecedores: permitir que projetista crie/edite fornecedores
--    (criação inline a partir do editor de orçamentos). As policies
--    originais cobriam admin/gerente/comprador.
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Privileged can insert fornecedores" ON public.fornecedores;
CREATE POLICY "Privileged can insert fornecedores"
  ON public.fornecedores FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'comprador')
    OR public.has_role(auth.uid(), 'projetista')
  );

DROP POLICY IF EXISTS "Privileged can update fornecedores" ON public.fornecedores;
CREATE POLICY "Privileged can update fornecedores"
  ON public.fornecedores FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'comprador')
    OR public.has_role(auth.uid(), 'projetista')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'comprador')
    OR public.has_role(auth.uid(), 'projetista')
  );

-- ---------------------------------------------------------------
-- 9. Data API: garantir acesso da role authenticated
-- ---------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_itens TO authenticated;

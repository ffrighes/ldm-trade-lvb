-- =============================================================
-- Migration: Módulo de Orçamentos
-- =============================================================

-- ---------------------------------------------------------------
-- 1. Extensões em tabelas existentes
-- ---------------------------------------------------------------

-- regime_tributario em fornecedores
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS regime_tributario TEXT NOT NULL DEFAULT 'lucro_real'
    CHECK (regime_tributario IN ('lucro_real', 'lucro_presumido', 'simples_nacional'));

-- pis_pct e cofins_pct em fornecedor_precos
ALTER TABLE public.fornecedor_precos
  ADD COLUMN IF NOT EXISTS pis_pct    NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (pis_pct    BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS cofins_pct NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (cofins_pct BETWEEN 0 AND 100);

-- ---------------------------------------------------------------
-- 2. Sequência para numeração automática de orçamentos
-- ---------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.orcamento_numero_seq START 1;

-- ---------------------------------------------------------------
-- 3. Tabela principal: orcamentos
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.orcamentos (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id              UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  numero                  TEXT        NOT NULL UNIQUE,
  nome                    TEXT        NOT NULL,
  notas                   TEXT        NOT NULL DEFAULT '',
  -- origem informativa (vínculo quebrado — sem FK)
  origem_bom_root_codigo  TEXT,
  origem_bom_version_label TEXT,
  origem_data_copia       TIMESTAMPTZ,
  created_by              UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-numero: ORC-0001
CREATE OR REPLACE FUNCTION public.orcamento_set_numero()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.numero := 'ORC-' || LPAD(nextval('public.orcamento_numero_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orcamento_set_numero ON public.orcamentos;
CREATE TRIGGER trg_orcamento_set_numero
  BEFORE INSERT ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.orcamento_set_numero();

-- updated_at
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

-- ---------------------------------------------------------------
-- 4. orcamento_itens
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.orcamento_itens (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id  UUID        NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  -- snapshot textual (imutável após cópia)
  descricao     TEXT        NOT NULL,
  bitola        TEXT        NOT NULL DEFAULT '',
  erp           TEXT        NOT NULL DEFAULT '',
  unidade       TEXT        NOT NULL DEFAULT 'un',
  quantidade    NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  notas         TEXT        NOT NULL DEFAULT '',
  -- referência fraca: apenas para busca de cotações
  material_id   UUID        REFERENCES public.materials(id) ON DELETE SET NULL,
  posicao       INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- 5. orcamento_fornecedores (N fornecedores por orçamento)
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.orcamento_fornecedores (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id  UUID        NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  fornecedor_id UUID        NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  posicao       INTEGER     NOT NULL DEFAULT 0,
  UNIQUE (orcamento_id, fornecedor_id)
);

-- ---------------------------------------------------------------
-- 6. orcamento_item_cotacoes (snapshot de preço por item×fornecedor)
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.orcamento_item_cotacoes (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id               UUID        NOT NULL REFERENCES public.orcamento_itens(id) ON DELETE CASCADE,
  fornecedor_id         UUID        NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  -- referência fraca para auditoria
  cotacao_origem_id     UUID,
  -- snapshot dos valores no momento da cópia
  codigo_fornecedor     TEXT        NOT NULL DEFAULT '',
  valor_unitario        NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  desconto_pct          NUMERIC(6,3)  NOT NULL DEFAULT 0 CHECK (desconto_pct   BETWEEN 0 AND 100),
  ipi_pct               NUMERIC(6,3)  NOT NULL DEFAULT 0 CHECK (ipi_pct        BETWEEN 0 AND 100),
  icms_pct              NUMERIC(6,3)  NOT NULL DEFAULT 0 CHECK (icms_pct       BETWEEN 0 AND 100),
  pis_pct               NUMERIC(6,3)  NOT NULL DEFAULT 0 CHECK (pis_pct        BETWEEN 0 AND 100),
  cofins_pct            NUMERIC(6,3)  NOT NULL DEFAULT 0 CHECK (cofins_pct     BETWEEN 0 AND 100),
  moq                   NUMERIC(14,4),
  lead_time_dias        INTEGER,
  sem_cotacao_vigente   BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, fornecedor_id)
);

-- ---------------------------------------------------------------
-- 7. Índices
-- ---------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_orcamentos_projeto
  ON public.orcamentos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_orc
  ON public.orcamento_itens(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_material
  ON public.orcamento_itens(material_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_forn_orc
  ON public.orcamento_fornecedores(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_item_cot_item
  ON public.orcamento_item_cotacoes(item_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_item_cot_forn
  ON public.orcamento_item_cotacoes(fornecedor_id);

-- ---------------------------------------------------------------
-- 8. Função SECURITY DEFINER: copy_bom_to_orcamento
-- ---------------------------------------------------------------
-- Copia todos os nós ITEM de uma bom_version para orcamento_itens,
-- calculando quantidade cumulativa de forma recursiva.

CREATE OR REPLACE FUNCTION public.copy_bom_to_orcamento(
  p_bom_version_id UUID,
  p_orcamento_id   UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_role  TEXT;
BEGIN
  -- Verificar role
  SELECT INTO v_role get_user_role(auth.uid());
  IF v_role NOT IN ('admin', 'gerente', 'comprador') THEN
    RAISE EXCEPTION 'Permissão negada: apenas admin, gerente e comprador podem copiar BOMs para orçamentos.';
  END IF;

  -- Inserir itens com quantidade cumulativa via CTE recursiva
  WITH RECURSIVE bom_tree AS (
    -- Raiz da versão (nó raiz virtual — inclui todos filhos diretos)
    SELECT
      n.id,
      n.parent_id,
      n.node_type,
      n.material_id,
      n.name,
      n.notes,
      n.position,
      COALESCE(n.quantity, 1)::NUMERIC AS cum_qty
    FROM public.bom_node n
    WHERE n.version_id = p_bom_version_id
      AND n.parent_id IS NULL

    UNION ALL

    SELECT
      child.id,
      child.parent_id,
      child.node_type,
      child.material_id,
      child.name,
      child.notes,
      child.position,
      (parent.cum_qty * COALESCE(child.quantity, 1))::NUMERIC AS cum_qty
    FROM public.bom_node child
    JOIN bom_tree parent ON child.parent_id = parent.id
    WHERE child.version_id = p_bom_version_id
  ),
  items_only AS (
    SELECT
      bt.material_id,
      bt.cum_qty,
      bt.notes,
      bt.position,
      m.descricao,
      m.bitola,
      m.erp,
      m.unidade
    FROM bom_tree bt
    LEFT JOIN public.materials m ON m.id = bt.material_id
    WHERE bt.node_type = 'ITEM'
  )
  INSERT INTO public.orcamento_itens
    (orcamento_id, descricao, bitola, erp, unidade, quantidade, notas, material_id, posicao)
  SELECT
    p_orcamento_id,
    COALESCE(io.descricao, io.notes, ''),
    COALESCE(io.bitola, ''),
    COALESCE(io.erp, ''),
    COALESCE(io.unidade, 'un'),
    io.cum_qty,
    COALESCE(io.notes, ''),
    io.material_id,
    io.position
  FROM items_only io;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.copy_bom_to_orcamento(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------
-- 9. RLS — orcamentos
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
    OR public.has_role(auth.uid(), 'comprador')
  );

DROP POLICY IF EXISTS "Privileged can update orcamentos" ON public.orcamentos;
CREATE POLICY "Privileged can update orcamentos"
  ON public.orcamentos FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "Admin/Gerente can delete orcamentos" ON public.orcamentos;
CREATE POLICY "Admin/Gerente can delete orcamentos"
  ON public.orcamentos FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
  );

-- ---------------------------------------------------------------
-- 10. RLS — orcamento_itens
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
    OR public.has_role(auth.uid(), 'comprador')
  );

DROP POLICY IF EXISTS "Privileged can update orcamento_itens" ON public.orcamento_itens;
CREATE POLICY "Privileged can update orcamento_itens"
  ON public.orcamento_itens FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "Admin/Gerente can delete orcamento_itens" ON public.orcamento_itens;
CREATE POLICY "Admin/Gerente can delete orcamento_itens"
  ON public.orcamento_itens FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
  );

-- ---------------------------------------------------------------
-- 11. RLS — orcamento_fornecedores
-- ---------------------------------------------------------------

ALTER TABLE public.orcamento_fornecedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read orcamento_fornecedores" ON public.orcamento_fornecedores;
CREATE POLICY "Authenticated can read orcamento_fornecedores"
  ON public.orcamento_fornecedores FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Privileged can insert orcamento_fornecedores" ON public.orcamento_fornecedores;
CREATE POLICY "Privileged can insert orcamento_fornecedores"
  ON public.orcamento_fornecedores FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'comprador')
  );

DROP POLICY IF EXISTS "Privileged can update orcamento_fornecedores" ON public.orcamento_fornecedores;
CREATE POLICY "Privileged can update orcamento_fornecedores"
  ON public.orcamento_fornecedores FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "Admin/Gerente can delete orcamento_fornecedores" ON public.orcamento_fornecedores;
CREATE POLICY "Admin/Gerente can delete orcamento_fornecedores"
  ON public.orcamento_fornecedores FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
  );

-- ---------------------------------------------------------------
-- 12. RLS — orcamento_item_cotacoes
-- ---------------------------------------------------------------

ALTER TABLE public.orcamento_item_cotacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read orcamento_item_cotacoes" ON public.orcamento_item_cotacoes;
CREATE POLICY "Authenticated can read orcamento_item_cotacoes"
  ON public.orcamento_item_cotacoes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Privileged can insert orcamento_item_cotacoes" ON public.orcamento_item_cotacoes;
CREATE POLICY "Privileged can insert orcamento_item_cotacoes"
  ON public.orcamento_item_cotacoes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'comprador')
  );

DROP POLICY IF EXISTS "Privileged can update orcamento_item_cotacoes" ON public.orcamento_item_cotacoes;
CREATE POLICY "Privileged can update orcamento_item_cotacoes"
  ON public.orcamento_item_cotacoes FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "Admin/Gerente can delete orcamento_item_cotacoes" ON public.orcamento_item_cotacoes;
CREATE POLICY "Admin/Gerente can delete orcamento_item_cotacoes"
  ON public.orcamento_item_cotacoes FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
  );

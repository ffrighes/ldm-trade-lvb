-- BOM Standard Catalog (Phase 1: schema changes).
--
-- Adds support for a global catalog of reusable standard Conjunto templates:
--   * bom_root.is_standard: marks a root as a global standard template.
--   * System project (UUID 00000000-0000-0000-0000-000000000001) hosts all
--     standard roots so project_id stays NOT NULL (Opção B do relatório de impacto).
--   * bom_root_usage: usage edges (parent → standard-child), with quantity (D3).
--   * Partial UNIQUE index ensures STD-* codes are unique across the catalog.
--
-- The "Conjunto filho" button now references a standard template via bom_root_usage
-- instead of creating a new root.  D1 (live reference): the edge stores child_root_id
-- and the reader always resolves the current RELEASED version of the child.

-- ── 1. System project for the global catalog ────────────────────────────────
-- Inserted idempotently; never appears in normal project listings because
-- is_system=true.  The UUID is a well-known constant — do NOT change it.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

INSERT INTO public.projects (id, numero, descricao, data_criacao, is_system)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'CATALOGO-GLOBAL',
  'Catálogo Padrão Global — conjuntos reutilizáveis',
  '2026-01-01',
  true
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Mark standard roots ──────────────────────────────────────────────────
-- All roots with is_standard=true live in the system project.
-- Validated inside bom_add_child_usage.

ALTER TABLE public.bom_root
  ADD COLUMN IF NOT EXISTS is_standard boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bom_root.is_standard IS
  'Quando true, este Conjunto é um padrão global reutilizável (catálogo). '
  'Pertence ao projeto sistema 00000000-0000-0000-0000-000000000001.';

-- ── 3. Unique code for standard roots ────────────────────────────────────────
-- The existing UNIQUE(project_id, codigo) still enforces uniqueness per project.
-- An additional partial index ensures catalog codes (STD-*) are globally unique.

CREATE UNIQUE INDEX IF NOT EXISTS uq_bom_root_standard_codigo
  ON public.bom_root (codigo)
  WHERE is_standard = true;

-- ── 4. Usage edges table ─────────────────────────────────────────────────────
-- One row per (parent root, child standard root) pair.
-- UNIQUE(parent_root_id, child_root_id) prevents duplicates.
-- ON DELETE RESTRICT on child_root_id prevents deleting a standard root that is
-- still referenced (per task constraint "NUNCA hard-delete de template referenciado").

CREATE TABLE IF NOT EXISTS public.bom_root_usage (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_root_id  uuid        NOT NULL REFERENCES public.bom_root(id) ON DELETE CASCADE,
  child_root_id   uuid        NOT NULL REFERENCES public.bom_root(id) ON DELETE RESTRICT,
  quantity        numeric     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  position        int         NOT NULL DEFAULT 0 CHECK (position >= 0),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bom_root_usage_no_self_ref   CHECK (parent_root_id <> child_root_id),
  CONSTRAINT bom_root_usage_unique_pair   UNIQUE (parent_root_id, child_root_id)
);

COMMENT ON TABLE public.bom_root_usage IS
  'Usage edges: a parent bom_root references a standard (is_standard=true) child '
  'bom_root with an explicit quantity (D3).  The reader resolves the current '
  'RELEASED bom_version of the child at query time (D1 live reference).';

COMMENT ON COLUMN public.bom_root_usage.quantity IS
  'M(path) = product of quantities along the root→node path. '
  'Units: m, mm, un, Bar, m³/h, °C — never round silently.';

-- ── 5. Indexes on bom_root_usage ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_bom_root_usage_parent_pos
  ON public.bom_root_usage (parent_root_id, position);

CREATE INDEX IF NOT EXISTS idx_bom_root_usage_child
  ON public.bom_root_usage (child_root_id);

-- ── 6. RLS for bom_root_usage ────────────────────────────────────────────────

ALTER TABLE public.bom_root_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bom_root_usage_select_authenticated ON public.bom_root_usage;
CREATE POLICY bom_root_usage_select_authenticated
  ON public.bom_root_usage FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS bom_root_usage_write_editors ON public.bom_root_usage;
CREATE POLICY bom_root_usage_write_editors
  ON public.bom_root_usage FOR ALL TO authenticated
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

-- ── DOWN (reversibility, run manually if needed) ─────────────────────────────
-- DROP TABLE IF EXISTS public.bom_root_usage;
-- DROP INDEX IF EXISTS uq_bom_root_standard_codigo;
-- ALTER TABLE public.bom_root DROP COLUMN IF EXISTS is_standard;
-- DELETE FROM public.projects WHERE id = '00000000-0000-0000-0000-000000000001';
-- ALTER TABLE public.projects DROP COLUMN IF EXISTS is_system;

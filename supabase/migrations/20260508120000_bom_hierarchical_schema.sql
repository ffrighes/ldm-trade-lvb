-- Hierarchical BOM (Phase 1: schema).
--
-- Introduces a Product Lifecycle Management style BOM tree alongside
-- the existing solicitacoes (purchase requests) entity.
--
-- Tables:
--   bom_root      -- "concept" of a Conjunto (root assembly), versioned
--   bom_version   -- versions of a Conjunto (DRAFT/RELEASED/OBSOLETE)
--   bom_node      -- tree nodes (CONJUNTO/SUBCONJUNTO/ITEM)
--   bom_audit     -- append-only audit trail (per version)
--   bom_comments  -- free-text comments (per version)
--   bom_drawings  -- multi-revision drawings (per version)

-- ============= ENUMS =============

DO $$ BEGIN
  CREATE TYPE public.bom_node_type AS ENUM ('CONJUNTO', 'SUBCONJUNTO', 'ITEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bom_version_status AS ENUM ('DRAFT', 'RELEASED', 'OBSOLETE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============= BOM ROOT =============
-- One row per Conjunto "concept" (identity that survives across versions).

CREATE TABLE IF NOT EXISTS public.bom_root (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  codigo      text NOT NULL CHECK (length(trim(codigo)) > 0 AND length(codigo) <= 64),
  name        text NOT NULL CHECK (length(trim(name))   > 0 AND length(name)   <= 200),
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  cloned_from_root_id uuid REFERENCES public.bom_root(id) ON DELETE SET NULL,
  UNIQUE (project_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_bom_root_project ON public.bom_root (project_id);

-- ============= BOM VERSION =============

CREATE TABLE IF NOT EXISTS public.bom_version (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_id         uuid NOT NULL REFERENCES public.bom_root(id) ON DELETE CASCADE,
  version_number  int  NOT NULL CHECK (version_number > 0),
  label           text,
  status          public.bom_version_status NOT NULL DEFAULT 'DRAFT',
  notes           text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  released_at     timestamptz,
  obsoleted_at    timestamptz,
  cloned_from_version_id uuid REFERENCES public.bom_version(id) ON DELETE SET NULL,
  UNIQUE (root_id, version_number)
);

-- At most one RELEASED version per root.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bom_version_one_released
  ON public.bom_version (root_id)
  WHERE status = 'RELEASED';

CREATE INDEX IF NOT EXISTS idx_bom_version_root ON public.bom_version (root_id, version_number DESC);

-- ============= BOM NODE =============

CREATE TABLE IF NOT EXISTS public.bom_node (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id   uuid NOT NULL REFERENCES public.bom_version(id) ON DELETE CASCADE,
  parent_id    uuid REFERENCES public.bom_node(id) ON DELETE CASCADE,
  node_type    public.bom_node_type NOT NULL,
  material_id  uuid REFERENCES public.materials(id) ON DELETE RESTRICT,
  name         text,
  quantity     numeric,
  position     int  NOT NULL DEFAULT 0,
  notes        text,
  cloned_from_node_id uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bom_node_shape CHECK (
    (node_type = 'CONJUNTO'    AND parent_id IS NULL     AND quantity IS NULL     AND material_id IS NULL     AND name IS NOT NULL)
    OR
    (node_type = 'SUBCONJUNTO' AND parent_id IS NOT NULL AND quantity IS NOT NULL AND material_id IS NULL     AND name IS NOT NULL)
    OR
    (node_type = 'ITEM'        AND parent_id IS NOT NULL AND quantity IS NOT NULL AND material_id IS NOT NULL)
  ),
  CONSTRAINT bom_node_qty_positive CHECK (quantity IS NULL OR quantity > 0),
  CONSTRAINT bom_node_position_nonneg CHECK (position >= 0)
);

CREATE INDEX IF NOT EXISTS idx_bom_node_version_parent_pos
  ON public.bom_node (version_id, parent_id NULLS FIRST, position);
CREATE INDEX IF NOT EXISTS idx_bom_node_material ON public.bom_node (material_id);
CREATE INDEX IF NOT EXISTS idx_bom_node_parent   ON public.bom_node (parent_id);

-- Only one CONJUNTO (root) per version.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bom_node_one_root_per_version
  ON public.bom_node (version_id)
  WHERE parent_id IS NULL;

-- ============= TRIGGERS =============

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.bom_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bom_root_touch ON public.bom_root;
CREATE TRIGGER trg_bom_root_touch BEFORE UPDATE ON public.bom_root
  FOR EACH ROW EXECUTE FUNCTION public.bom_touch_updated_at();

DROP TRIGGER IF EXISTS trg_bom_node_touch ON public.bom_node;
CREATE TRIGGER trg_bom_node_touch BEFORE UPDATE ON public.bom_node
  FOR EACH ROW EXECUTE FUNCTION public.bom_touch_updated_at();

-- Validate node parent/version relationships, depth, and cycles.
-- Maximum depth: 10 (CONJUNTO at depth 1).
CREATE OR REPLACE FUNCTION public.bom_validate_node()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent          public.bom_node;
  v_depth           int := 1;
  v_cur             uuid;
  v_visited         uuid[] := ARRAY[]::uuid[];
  v_max_depth       constant int := 10;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT * INTO v_parent FROM public.bom_node WHERE id = NEW.parent_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent node % not found', NEW.parent_id;
    END IF;
    IF v_parent.version_id <> NEW.version_id THEN
      RAISE EXCEPTION 'Parent node belongs to a different version';
    END IF;
    IF v_parent.node_type = 'ITEM' THEN
      RAISE EXCEPTION 'ITEM nodes cannot have children';
    END IF;
    IF NEW.node_type = 'CONJUNTO' THEN
      RAISE EXCEPTION 'CONJUNTO must be the root (parent_id NULL)';
    END IF;

    -- Walk up to compute depth and detect cycles.
    v_cur := v_parent.id;
    WHILE v_cur IS NOT NULL LOOP
      IF NEW.id IS NOT NULL AND v_cur = NEW.id THEN
        RAISE EXCEPTION 'Cycle detected: node % cannot be its own ancestor', NEW.id;
      END IF;
      IF v_cur = ANY(v_visited) THEN
        RAISE EXCEPTION 'Cycle detected in BOM tree at node %', v_cur;
      END IF;
      v_visited := v_visited || v_cur;
      v_depth := v_depth + 1;
      IF v_depth > v_max_depth THEN
        RAISE EXCEPTION 'Maximum BOM depth (%) exceeded', v_max_depth;
      END IF;
      SELECT parent_id INTO v_cur FROM public.bom_node WHERE id = v_cur;
    END LOOP;
  ELSE
    IF NEW.node_type <> 'CONJUNTO' THEN
      RAISE EXCEPTION 'Only CONJUNTO nodes can be at the root';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bom_node_validate ON public.bom_node;
CREATE TRIGGER trg_bom_node_validate
  BEFORE INSERT OR UPDATE OF parent_id, node_type, version_id ON public.bom_node
  FOR EACH ROW EXECUTE FUNCTION public.bom_validate_node();

-- Block direct mutations on nodes whose version is not DRAFT.
-- Allowed only when the session sets the GUC `app.bom_allow_non_draft_write`
-- to 'on' (used by SECURITY DEFINER copy/release functions).
CREATE OR REPLACE FUNCTION public.bom_guard_non_draft()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status public.bom_version_status;
  v_bypass text;
BEGIN
  v_bypass := current_setting('app.bom_allow_non_draft_write', true);
  IF v_bypass = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT status INTO v_status FROM public.bom_version WHERE id = OLD.version_id;
  ELSE
    SELECT status INTO v_status FROM public.bom_version WHERE id = NEW.version_id;
  END IF;

  IF v_status IS NOT NULL AND v_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Cannot modify nodes of a % version', v_status;
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_bom_node_guard ON public.bom_node;
CREATE TRIGGER trg_bom_node_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.bom_node
  FOR EACH ROW EXECUTE FUNCTION public.bom_guard_non_draft();

-- Manage version status transitions:
--   * stamp released_at / obsoleted_at
--   * when a version transitions to RELEASED, auto-OBSOLETE the previously
--     RELEASED version of the same root (single-RELEASED rule).
--   * RELEASED <-> RELEASED (no-op) and DRAFT->OBSOLETE allowed.
CREATE OR REPLACE FUNCTION public.bom_version_status_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'OBSOLETE' AND NEW.status <> 'OBSOLETE' THEN
      RAISE EXCEPTION 'OBSOLETE versions are immutable';
    END IF;
    IF OLD.status = 'RELEASED' AND NEW.status = 'DRAFT' THEN
      RAISE EXCEPTION 'Cannot move RELEASED back to DRAFT';
    END IF;
  END IF;

  IF NEW.status = 'RELEASED' AND (TG_OP = 'INSERT' OR OLD.status <> 'RELEASED') THEN
    NEW.released_at := COALESCE(NEW.released_at, now());
    -- demote any other RELEASED of the same root
    UPDATE public.bom_version
       SET status = 'OBSOLETE', obsoleted_at = now()
     WHERE root_id = NEW.root_id
       AND status = 'RELEASED'
       AND id <> NEW.id;
  ELSIF NEW.status = 'OBSOLETE' AND (TG_OP = 'INSERT' OR OLD.status <> 'OBSOLETE') THEN
    NEW.obsoleted_at := COALESCE(NEW.obsoleted_at, now());
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bom_version_status_guard ON public.bom_version;
CREATE TRIGGER trg_bom_version_status_guard
  BEFORE INSERT OR UPDATE OF status ON public.bom_version
  FOR EACH ROW EXECUTE FUNCTION public.bom_version_status_guard();

-- ============= AUDIT =============

CREATE TABLE IF NOT EXISTS public.bom_audit (
  id              bigserial PRIMARY KEY,
  root_id         uuid REFERENCES public.bom_root(id)    ON DELETE SET NULL,
  version_id      uuid REFERENCES public.bom_version(id) ON DELETE SET NULL,
  node_id         uuid,
  entity          text NOT NULL CHECK (entity IN ('ROOT', 'VERSION', 'NODE')),
  action          text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  actor_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email     text,
  before          jsonb,
  after           jsonb,
  changed_fields  text[],
  at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bom_audit_version ON public.bom_audit (version_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_bom_audit_root    ON public.bom_audit (root_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_bom_audit_at      ON public.bom_audit (at DESC);

CREATE OR REPLACE FUNCTION public.log_bom_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_id    uuid := auth.uid();
  v_actor_email text;
  v_before      jsonb;
  v_after       jsonb;
  v_changed     text[];
  v_entity      text;
  v_root_id     uuid;
  v_version_id  uuid;
  v_node_id     uuid;
BEGIN
  IF v_actor_id IS NOT NULL THEN
    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;
  END IF;

  v_entity := CASE TG_TABLE_NAME
                WHEN 'bom_root'    THEN 'ROOT'
                WHEN 'bom_version' THEN 'VERSION'
                WHEN 'bom_node'    THEN 'NODE'
              END;

  IF TG_OP = 'INSERT' THEN
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_before := to_jsonb(OLD);
    v_after  := to_jsonb(NEW);
    IF v_before IS NOT DISTINCT FROM v_after THEN RETURN NEW; END IF;
    SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::text[])
      INTO v_changed
      FROM (
        SELECT key FROM jsonb_each(v_after)
         WHERE v_before -> key IS DISTINCT FROM v_after -> key
      ) d;
  ELSIF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD);
  END IF;

  IF TG_TABLE_NAME = 'bom_root' THEN
    v_root_id := COALESCE((NEW).id, (OLD).id);
  ELSIF TG_TABLE_NAME = 'bom_version' THEN
    v_version_id := COALESCE((NEW).id, (OLD).id);
    v_root_id    := COALESCE((NEW).root_id, (OLD).root_id);
  ELSIF TG_TABLE_NAME = 'bom_node' THEN
    v_node_id    := COALESCE((NEW).id, (OLD).id);
    v_version_id := COALESCE((NEW).version_id, (OLD).version_id);
    SELECT root_id INTO v_root_id FROM public.bom_version WHERE id = v_version_id;
  END IF;

  INSERT INTO public.bom_audit
    (root_id, version_id, node_id, entity, action, actor_id, actor_email, before, after, changed_fields)
  VALUES
    (v_root_id, v_version_id, v_node_id, v_entity, TG_OP, v_actor_id, v_actor_email, v_before, v_after, v_changed);

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_audit_bom_root ON public.bom_root;
CREATE TRIGGER trg_audit_bom_root
  AFTER INSERT OR UPDATE OR DELETE ON public.bom_root
  FOR EACH ROW EXECUTE FUNCTION public.log_bom_audit();

DROP TRIGGER IF EXISTS trg_audit_bom_version ON public.bom_version;
CREATE TRIGGER trg_audit_bom_version
  AFTER INSERT OR UPDATE OR DELETE ON public.bom_version
  FOR EACH ROW EXECUTE FUNCTION public.log_bom_audit();

DROP TRIGGER IF EXISTS trg_audit_bom_node ON public.bom_node;
CREATE TRIGGER trg_audit_bom_node
  AFTER INSERT OR UPDATE OR DELETE ON public.bom_node
  FOR EACH ROW EXECUTE FUNCTION public.log_bom_audit();

-- ============= COMMENTS =============

CREATE TABLE IF NOT EXISTS public.bom_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id   uuid NOT NULL REFERENCES public.bom_version(id) ON DELETE CASCADE,
  author_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email text NOT NULL,
  body         text NOT NULL CHECK (length(trim(body)) > 0 AND length(body) <= 2000),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bom_comments_version ON public.bom_comments (version_id, created_at DESC);

-- ============= DRAWINGS =============

CREATE TABLE IF NOT EXISTS public.bom_drawings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id   uuid NOT NULL REFERENCES public.bom_version(id) ON DELETE CASCADE,
  revision     text NOT NULL CHECK (length(trim(revision)) > 0 AND length(revision) <= 32),
  url          text NOT NULL,
  uploaded_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at  timestamptz NOT NULL DEFAULT now(),
  notes        text,
  UNIQUE (version_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_bom_drawings_version ON public.bom_drawings (version_id, uploaded_at DESC);

-- ============= RLS =============
-- Mirrors the role model used elsewhere (admin/gerente/projetista write,
-- everyone authenticated reads).

ALTER TABLE public.bom_root     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_version  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_node     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_audit    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_drawings ENABLE ROW LEVEL SECURITY;

-- helper: authenticated select on every BOM table
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bom_root','bom_version','bom_node','bom_audit','bom_comments','bom_drawings'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   t || '_select_authenticated', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)$f$,
                   t || '_select_authenticated', t);
  END LOOP;
END $$;

-- write policies for editors (admin/gerente/projetista) on root/version/node
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bom_root','bom_version','bom_node'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write_editors', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR ALL TO authenticated
        USING (
          public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'gerente')
          OR public.has_role(auth.uid(), 'projetista')
        )
        WITH CHECK (
          public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'gerente')
          OR public.has_role(auth.uid(), 'projetista')
        )
    $f$, t || '_write_editors', t);
  END LOOP;
END $$;

-- comments: any authenticated user can write; only author/admin/gerente can delete.
DROP POLICY IF EXISTS bom_comments_insert_authenticated ON public.bom_comments;
CREATE POLICY bom_comments_insert_authenticated
  ON public.bom_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS bom_comments_delete_author_or_admin ON public.bom_comments;
CREATE POLICY bom_comments_delete_author_or_admin
  ON public.bom_comments FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
  );

-- drawings: editors only
DROP POLICY IF EXISTS bom_drawings_write_editors ON public.bom_drawings;
CREATE POLICY bom_drawings_write_editors
  ON public.bom_drawings FOR ALL TO authenticated
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

-- audit: read-only via API; the SECURITY DEFINER trigger writes it.

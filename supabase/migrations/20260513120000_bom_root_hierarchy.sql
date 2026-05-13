-- bom_root hierarchy: adds parent_id (self-referencing FK) so Conjuntos can be
-- nested inside each other within the same project.
--
-- Rules enforced here:
--   1. A root cannot be its own parent (CHECK constraint).
--   2. Circular references are blocked by a BEFORE UPDATE trigger.
--   3. Deleting a parent sets children's parent_id to NULL (ON DELETE SET NULL)
--      — the UI offers "cascade delete" via the bom_drop_root_cascade RPC below.

-- ── 1. Schema change ────────────────────────────────────────────────────────

ALTER TABLE public.bom_root
  ADD COLUMN IF NOT EXISTS parent_id uuid
    REFERENCES public.bom_root(id) ON DELETE SET NULL;

ALTER TABLE public.bom_root
  ADD CONSTRAINT bom_root_no_self_ref CHECK (parent_id IS DISTINCT FROM id);

CREATE INDEX IF NOT EXISTS idx_bom_root_parent ON public.bom_root (parent_id);

-- ── 2. Cycle detection helper ────────────────────────────────────────────────
-- Returns TRUE when making `p_root_id` a child of `p_new_parent` would create
-- a cycle (i.e. p_new_parent is already a descendant of p_root_id).

CREATE OR REPLACE FUNCTION public.bom_root_would_cycle(
  p_root_id   uuid,
  p_new_parent uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH RECURSIVE ancestors AS (
    SELECT id, parent_id
    FROM   public.bom_root
    WHERE  id = p_new_parent

    UNION ALL

    SELECT r.id, r.parent_id
    FROM   public.bom_root r
    JOIN   ancestors a ON r.id = a.parent_id
  )
  SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = p_root_id);
$$;

-- ── 3. Trigger: block cycles on UPDATE ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.bom_root_check_cycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Um Conjunto não pode ser seu próprio pai.';
  END IF;
  IF public.bom_root_would_cycle(NEW.id, NEW.parent_id) THEN
    RAISE EXCEPTION 'Operação criaria uma referência circular entre Conjuntos.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bom_root_check_cycle ON public.bom_root;
CREATE TRIGGER trg_bom_root_check_cycle
  BEFORE INSERT OR UPDATE OF parent_id ON public.bom_root
  FOR EACH ROW EXECUTE FUNCTION public.bom_root_check_cycle();

-- ── 4. RPC: set parent ───────────────────────────────────────────────────────
-- Sets or clears the parent of a Conjunto.  Validates same project and no cycle.

CREATE OR REPLACE FUNCTION public.bom_root_set_parent(
  p_root_id   uuid,
  p_parent_id uuid   -- pass NULL to move to root level
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_root_project   uuid;
  v_parent_project uuid;
BEGIN
  SELECT project_id INTO v_root_project   FROM public.bom_root WHERE id = p_root_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conjunto % não encontrado.', p_root_id;
  END IF;

  IF p_parent_id IS NOT NULL THEN
    SELECT project_id INTO v_parent_project FROM public.bom_root WHERE id = p_parent_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conjunto pai % não encontrado.', p_parent_id;
    END IF;
    IF v_root_project <> v_parent_project THEN
      RAISE EXCEPTION 'O Conjunto pai deve pertencer ao mesmo projeto.';
    END IF;
    IF p_parent_id = p_root_id THEN
      RAISE EXCEPTION 'Um Conjunto não pode ser seu próprio pai.';
    END IF;
    IF public.bom_root_would_cycle(p_root_id, p_parent_id) THEN
      RAISE EXCEPTION 'Operação criaria uma referência circular entre Conjuntos.';
    END IF;
  END IF;

  UPDATE public.bom_root SET parent_id = p_parent_id WHERE id = p_root_id;
END;
$$;

-- ── 5. RPC: cascade drop ────────────────────────────────────────────────────
-- Deletes a Conjunto and ALL its descendants (sub-trees of bom_root), each
-- with their versions and nodes.  Uses the existing bom_drop_root logic by
-- building the descendant list with a recursive CTE and deleting bottom-up.

CREATE OR REPLACE FUNCTION public.bom_drop_root_cascade(p_root_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Collect descendants in reverse depth order (leaves first) so FK cascades
  -- on bom_version / bom_node are respected.
  FOR v_id IN
    WITH RECURSIVE tree AS (
      SELECT id, parent_id, 0 AS depth
      FROM   public.bom_root
      WHERE  id = p_root_id

      UNION ALL

      SELECT r.id, r.parent_id, t.depth + 1
      FROM   public.bom_root r
      JOIN   tree t ON r.parent_id = t.id
    )
    SELECT id FROM tree ORDER BY depth DESC
  LOOP
    -- bom_version rows cascade-delete bom_node rows automatically.
    DELETE FROM public.bom_version WHERE root_id = v_id;
    DELETE FROM public.bom_root    WHERE id      = v_id;
  END LOOP;
END;
$$;

-- ── 6. Grants ────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.bom_root_would_cycle(uuid, uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.bom_root_set_parent(uuid, uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.bom_drop_root_cascade(uuid)         TO authenticated;

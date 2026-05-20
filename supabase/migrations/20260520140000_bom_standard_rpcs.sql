-- BOM Standard Catalog (Phase 2: RPCs).
--
-- Five new SECURITY DEFINER functions:
--   bom_usage_would_cycle         — cycle detection crossing parent_id + bom_root_usage
--   bom_add_child_usage           — add a usage edge (parent → standard child)
--   bom_remove_child_usage        — remove a usage edge by id
--   bom_consolidate_materials     — aggregate all materials in 1 Postgres query (D1 live)
--   bom_set_standard              — mark/unmark a root as global standard
--
-- Also extends bom_release_version to log affected parents when a standard root
-- releases a new version (Conflict 4 mitigation).

-- ── 1. bom_usage_would_cycle ────────────────────────────────────────────────
-- Returns TRUE when adding an edge (parent=p_parent_root_id → child=p_child_root_id)
-- would create a cycle.  Traverses ancestors of p_parent_root_id upward via BOTH:
--   a) bom_root.parent_id  (tree edges)
--   b) bom_root_usage      (usage edges: walk from child to parent)
-- If p_child_root_id appears as an ancestor, the edge would close a cycle.

CREATE OR REPLACE FUNCTION public.bom_usage_would_cycle(
  p_parent_root_id uuid,
  p_child_root_id  uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE ancestors(id) AS (
    SELECT p_parent_root_id

    UNION

    SELECT x.ancestor_id
    FROM   ancestors a
    JOIN LATERAL (
      -- Go up via parent_id tree
      SELECT r.parent_id AS ancestor_id
      FROM   public.bom_root r
      WHERE  r.id = a.id
        AND  r.parent_id IS NOT NULL

      UNION ALL

      -- Go up via bom_root_usage (this node is a child of some parent)
      SELECT u.parent_root_id AS ancestor_id
      FROM   public.bom_root_usage u
      WHERE  u.child_root_id = a.id
    ) x ON true
  )
  SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = p_child_root_id);
$$;

GRANT EXECUTE ON FUNCTION public.bom_usage_would_cycle(uuid, uuid) TO authenticated;

-- ── 2. bom_add_child_usage ───────────────────────────────────────────────────
-- Inserts one usage edge: parent_root_id → child_root_id.
-- Validations:
--   * caller must be an editor (admin/gerente/projetista)
--   * child must have is_standard = true
--   * no cycle (bom_usage_would_cycle)
--   * bom_node is NEVER copied — edge only

CREATE OR REPLACE FUNCTION public.bom_add_child_usage(
  p_parent_root_id uuid,
  p_child_root_id  uuid,
  p_quantity       numeric  DEFAULT 1,
  p_position       int      DEFAULT 0,
  p_notes          text     DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_standard boolean;
  v_usage_id    uuid;
BEGIN
  PERFORM public.bom_assert_editor();

  -- Validate child exists and is a standard catalog entry
  SELECT is_standard INTO v_is_standard
  FROM   public.bom_root
  WHERE  id = p_child_root_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conjunto filho % não encontrado.', p_child_root_id;
  END IF;

  IF NOT v_is_standard THEN
    RAISE EXCEPTION 'Somente conjuntos do catálogo padrão (is_standard = true) podem ser referenciados como filho.';
  END IF;

  IF p_parent_root_id = p_child_root_id THEN
    RAISE EXCEPTION 'Um Conjunto não pode referenciar a si mesmo.';
  END IF;

  -- Validate quantity
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero.';
  END IF;

  -- Anti-cycle check crossing both edge types
  IF public.bom_usage_would_cycle(p_parent_root_id, p_child_root_id) THEN
    RAISE EXCEPTION 'Operação criaria referência circular entre Conjuntos.';
  END IF;

  INSERT INTO public.bom_root_usage
    (parent_root_id, child_root_id, quantity, position, notes)
  VALUES
    (p_parent_root_id, p_child_root_id, p_quantity, p_position, p_notes)
  RETURNING id INTO v_usage_id;

  RETURN v_usage_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bom_add_child_usage(uuid, uuid, numeric, int, text) TO authenticated;

-- ── 3. bom_remove_child_usage ────────────────────────────────────────────────
-- Removes a single usage edge by its id.
-- Does NOT delete the referenced standard root (ON DELETE RESTRICT protects it).

CREATE OR REPLACE FUNCTION public.bom_remove_child_usage(
  p_usage_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM public.bom_assert_editor();

  DELETE FROM public.bom_root_usage WHERE id = p_usage_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referência de catálogo % não encontrada.', p_usage_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bom_remove_child_usage(uuid) TO authenticated;

-- ── 4. bom_consolidate_materials ─────────────────────────────────────────────
-- Aggregates all materials for a given bom_root in a single Postgres query.
-- Replaces the client-side collectAllItems() in exportConjuntoPdf.ts.
--
-- Algorithm (all in one CTE chain):
--   a) root_expansion: expand all descendant roots via parent_id tree AND
--      bom_root_usage edges, accumulating the quantity multiplier along each path.
--   b) released: for each root, sum multipliers from all paths and resolve the
--      current RELEASED bom_version (D1 live reference).
--   c) node_traversal: walk bom_node tree within each version, accumulating
--      per-path quantities (M(path) = product of quantities root→node).
--   d) Final GROUP BY material_id sums total_qty across all paths and versions.
--
-- Formula preserved: M(path) = ∏ quantity of each edge on the path root→node
-- Units: m, mm, un, Bar, m³/h, °C — never rounded.

CREATE OR REPLACE FUNCTION public.bom_consolidate_materials(
  p_root_id uuid
) RETURNS TABLE (material_id uuid, total_qty numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE

  -- Step a: expand the full root subtree (tree + usage edges)
  root_expansion(root_id, multiplier) AS (
    SELECT p_root_id, CAST(1.0 AS numeric)

    UNION ALL

    SELECT x.child_id, re.multiplier * x.qty
    FROM   root_expansion re
    JOIN LATERAL (
      -- Children via parent_id tree (quantity_in_parent is the edge weight)
      SELECT child.id AS child_id, child.quantity_in_parent AS qty
      FROM   public.bom_root child
      WHERE  child.parent_id = re.root_id

      UNION ALL

      -- Children via bom_root_usage (explicit quantity on the edge)
      SELECT u.child_root_id, u.quantity
      FROM   public.bom_root_usage u
      WHERE  u.parent_root_id = re.root_id
    ) x(child_id, qty) ON true
  ),

  -- Step b: resolve current RELEASED version per root, summing all-path multipliers
  released AS (
    SELECT
      re.root_id,
      SUM(re.multiplier) AS total_multiplier,
      bv.id              AS version_id
    FROM      root_expansion re
    JOIN      public.bom_version bv
           ON bv.root_id = re.root_id
          AND bv.status  = 'RELEASED'
    GROUP BY  re.root_id, bv.id
  ),

  -- Step c: walk bom_node tree within each version, accumulating path quantities
  -- Starts at the CONJUNTO root node (parent_id IS NULL, quantity IS NULL → treated as 1)
  node_traversal(node_id, version_id, accumulated_qty) AS (
    SELECT bn.id, r.version_id, r.total_multiplier
    FROM   released r
    JOIN   public.bom_node bn
        ON bn.version_id = r.version_id
       AND bn.parent_id IS NULL

    UNION ALL

    SELECT bn.id, nt.version_id, nt.accumulated_qty * bn.quantity
    FROM   node_traversal nt
    JOIN   public.bom_node bn
        ON bn.parent_id  = nt.node_id
       AND bn.version_id = nt.version_id
       AND bn.quantity   IS NOT NULL
  )

  -- Step d: sum per material across all paths
  SELECT
    bn.material_id,
    SUM(nt.accumulated_qty) AS total_qty
  FROM      node_traversal nt
  JOIN      public.bom_node bn ON bn.id = nt.node_id
  WHERE     bn.node_type   = 'ITEM'
    AND     bn.material_id IS NOT NULL
  GROUP BY  bn.material_id;
$$;

GRANT EXECUTE ON FUNCTION public.bom_consolidate_materials(uuid) TO authenticated;

-- ── 5. bom_set_standard ──────────────────────────────────────────────────────
-- Marks or unmarks a bom_root as a global standard catalog entry.
-- When marking as standard:
--   * moves the root to the system project (00000000-0000-0000-0000-000000000001)
--   * validates the codigo starts with 'STD-'
-- When unmarking:
--   * rejects if the root is still referenced by any bom_root_usage edge
-- Requires editor role (admin/gerente/projetista per user confirmation).

CREATE OR REPLACE FUNCTION public.bom_set_standard(
  p_root_id     uuid,
  p_is_standard boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_codigo   text;
  v_ref_count int;
BEGIN
  PERFORM public.bom_assert_editor();

  SELECT codigo INTO v_codigo FROM public.bom_root WHERE id = p_root_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conjunto % não encontrado.', p_root_id;
  END IF;

  IF p_is_standard THEN
    -- Enforce STD- prefix convention
    IF v_codigo NOT LIKE 'STD-%' THEN
      RAISE EXCEPTION 'Conjuntos do catálogo global devem ter código com prefixo STD- (atual: %).', v_codigo;
    END IF;

    UPDATE public.bom_root
       SET is_standard = true,
           project_id  = '00000000-0000-0000-0000-000000000001'
     WHERE id = p_root_id;
  ELSE
    -- Prevent unmarking if still referenced
    SELECT COUNT(*) INTO v_ref_count
    FROM   public.bom_root_usage
    WHERE  child_root_id = p_root_id;

    IF v_ref_count > 0 THEN
      RAISE EXCEPTION
        'Conjunto ainda é referenciado em % uso(s). Remova as referências antes de retirá-lo do catálogo.',
        v_ref_count;
    END IF;

    UPDATE public.bom_root
       SET is_standard = false
     WHERE id = p_root_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bom_set_standard(uuid, boolean) TO authenticated;

-- ── 6. Extend bom_release_version: log parents when a standard root releases ─
-- When a standard root (is_standard=true) releases a new version, insert one
-- bom_audit row per parent (from bom_root_usage) so the audit trail shows which
-- assemblies are affected by the propagation (Conflict 4 mitigation).

CREATE OR REPLACE FUNCTION public.bom_release_version(p_version_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_status   public.bom_version_status;
  v_root_id  uuid;
  v_standard boolean;
  v_parent   RECORD;
BEGIN
  PERFORM public.bom_assert_editor();

  SELECT bv.status, bv.root_id, br.is_standard
    INTO v_status, v_root_id, v_standard
  FROM   public.bom_version bv
  JOIN   public.bom_root br ON br.id = bv.root_id
  WHERE  bv.id = p_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version % not found', p_version_id;
  END IF;

  IF v_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Only DRAFT versions can be released (current status: %)', v_status;
  END IF;

  -- Status guard trigger demotes the previous RELEASED version.
  UPDATE public.bom_version SET status = 'RELEASED' WHERE id = p_version_id;

  -- If this is a standard root, log affected parents in bom_audit
  IF v_standard THEN
    FOR v_parent IN
      SELECT parent_root_id
      FROM   public.bom_root_usage
      WHERE  child_root_id = v_root_id
    LOOP
      INSERT INTO public.bom_audit
        (root_id, version_id, entity, action, actor_id, actor_email, after, changed_fields)
      VALUES (
        v_parent.parent_root_id,
        p_version_id,
        'ROOT',
        'UPDATE',
        auth.uid(),
        (SELECT email FROM auth.users WHERE id = auth.uid()),
        jsonb_build_object(
          'event',             'referenced_standard_released',
          'standard_root_id',  v_root_id,
          'released_version',  p_version_id
        ),
        ARRAY['referenced_standard_released']
      );
    END LOOP;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bom_release_version(uuid) TO authenticated;

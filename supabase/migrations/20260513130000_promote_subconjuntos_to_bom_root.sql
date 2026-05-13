-- Promote legacy in-tree SUBCONJUNTO bom_node rows into bom_root entries so they
-- appear in the BOMs sidebar as child Conjuntos of their parent root.
--
-- For each bom_node N with node_type = 'SUBCONJUNTO' (processed bottom-up so
-- nested subconjuntos are handled correctly):
--   1. Resolve the bom_root R that owns N's bom_version.
--   2. Create a new bom_root NR with parent_id = R, same project, codigo derived
--      from R.codigo (next free <R.codigo>.<n>), name = N.name.
--   3. Create an initial DRAFT bom_version V for NR with a CONJUNTO root node C.
--   4. Re-parent N's direct ITEM children under C (preserving position).
--      SUBCONJUNTO descendants are processed by earlier iterations of the loop
--      (bottom-up), so by the time we reach a higher SUBCONJUNTO its sub-roots
--      already exist and there are no SUBCONJUNTO node descendants left to copy.
--   5. Delete N.
--
-- Idempotent: a marker table is used so re-running the migration is a no-op.

CREATE TABLE IF NOT EXISTS public._migration_state (
  key text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  v_already boolean;
  v_node       record;
  v_parent_root_id uuid;
  v_parent_codigo  text;
  v_project_id     uuid;
  v_new_root_id    uuid;
  v_new_version_id uuid;
  v_new_root_node_id uuid;
  v_codigo_candidate text;
  v_n int;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public._migration_state
    WHERE key = '20260513130000_promote_subconjuntos_to_bom_root'
  ) INTO v_already;
  IF v_already THEN
    RAISE NOTICE 'promote_subconjuntos_to_bom_root: already applied, skipping';
    RETURN;
  END IF;

  -- Bottom-up traversal: order nodes so children are processed before parents.
  -- We approximate "bottom-up" by computing depth via recursive CTE.
  FOR v_node IN
    WITH RECURSIVE node_depth AS (
      SELECT n.id, n.version_id, n.parent_id, n.name, n.position, 0 AS depth
      FROM   public.bom_node n
      WHERE  n.parent_id IS NULL
      UNION ALL
      SELECT c.id, c.version_id, c.parent_id, c.name, c.position, p.depth + 1
      FROM   public.bom_node c
      JOIN   node_depth p ON c.parent_id = p.id
    )
    SELECT n.id, n.version_id, n.name, nd.depth
    FROM   public.bom_node n
    JOIN   node_depth nd ON nd.id = n.id
    WHERE  n.node_type = 'SUBCONJUNTO'
    ORDER  BY nd.depth DESC
  LOOP
    -- 1. Resolve parent root + project for this SUBCONJUNTO's version
    SELECT v.root_id, r.codigo, r.project_id
    INTO   v_parent_root_id, v_parent_codigo, v_project_id
    FROM   public.bom_version v
    JOIN   public.bom_root r ON r.id = v.root_id
    WHERE  v.id = v_node.version_id;

    IF v_parent_root_id IS NULL THEN
      RAISE NOTICE 'Skipping SUBCONJUNTO % (orphan version)', v_node.id;
      CONTINUE;
    END IF;

    -- 2. Find next free codigo of the form <parent_codigo>.<n>
    v_n := 1;
    LOOP
      v_codigo_candidate := v_parent_codigo || '.' || v_n;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.bom_root
        WHERE  project_id = v_project_id AND codigo = v_codigo_candidate
      );
      v_n := v_n + 1;
      IF v_n > 9999 THEN
        RAISE EXCEPTION 'Could not allocate child codigo for %', v_parent_codigo;
      END IF;
    END LOOP;

    -- 3. Create the new bom_root child + initial DRAFT version + CONJUNTO root node
    INSERT INTO public.bom_root (project_id, codigo, name, parent_id)
    VALUES (v_project_id, v_codigo_candidate, COALESCE(NULLIF(v_node.name, ''), v_codigo_candidate), v_parent_root_id)
    RETURNING id INTO v_new_root_id;

    INSERT INTO public.bom_version (root_id, version_number, status)
    VALUES (v_new_root_id, 1, 'DRAFT')
    RETURNING id INTO v_new_version_id;

    INSERT INTO public.bom_node (version_id, parent_id, node_type, name, position, quantity, material_id)
    VALUES (v_new_version_id, NULL, 'CONJUNTO', COALESCE(NULLIF(v_node.name, ''), v_codigo_candidate), 0, NULL, NULL)
    RETURNING id INTO v_new_root_node_id;

    -- 4. Move direct children of the old SUBCONJUNTO node into the new version
    --    under the new CONJUNTO root node.  Because we iterate bottom-up, any
    --    SUBCONJUNTO descendants have already been migrated away, so the
    --    remaining direct children are ITEM (or any leftover groups, which we
    --    also move as-is).
    UPDATE public.bom_node
    SET    version_id = v_new_version_id,
           parent_id  = v_new_root_node_id
    WHERE  parent_id  = v_node.id;

    -- 5. Delete the old SUBCONJUNTO node
    DELETE FROM public.bom_node WHERE id = v_node.id;
  END LOOP;

  INSERT INTO public._migration_state (key)
  VALUES ('20260513130000_promote_subconjuntos_to_bom_root');
END;
$$ LANGUAGE plpgsql;

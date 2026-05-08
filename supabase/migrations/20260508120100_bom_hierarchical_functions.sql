-- Hierarchical BOM (Phase 2: server-side operations).
--
-- All mutation entry points exposed to the client are SECURITY DEFINER
-- functions that:
--   * verify the caller has an editor role (admin, gerente or projetista),
--   * run inside a single transaction (the function body),
--   * delegate hierarchy/depth/cycle validation to the bom_validate_node
--     trigger on bom_node.
--
-- Read paths use the regular tables under their RLS SELECT policies.

-- ============= HELPERS =============

CREATE OR REPLACE FUNCTION public.bom_can_edit()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public, auth
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gerente')
      OR public.has_role(auth.uid(), 'projetista')
$$;

CREATE OR REPLACE FUNCTION public.bom_assert_editor()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.bom_can_edit() THEN
    RAISE EXCEPTION 'Permission denied: editor role required';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.bom_assert_draft(p_version_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_status public.bom_version_status;
BEGIN
  SELECT status INTO v_status FROM public.bom_version WHERE id = p_version_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Version % not found', p_version_id;
  END IF;
  IF v_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Version is %; only DRAFT versions can be modified', v_status;
  END IF;
END $$;

-- ============= CONJUNTO (ROOT) =============

CREATE OR REPLACE FUNCTION public.bom_create_conjunto(
  p_project_id uuid,
  p_codigo     text,
  p_name       text,
  p_label      text DEFAULT NULL,
  p_notes      text DEFAULT NULL
)
RETURNS TABLE (root_id uuid, version_id uuid, root_node_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_root_id uuid;
  v_version uuid;
  v_node    uuid;
BEGIN
  PERFORM public.bom_assert_editor();

  INSERT INTO public.bom_root (project_id, codigo, name, created_by)
    VALUES (p_project_id, p_codigo, p_name, auth.uid())
    RETURNING id INTO v_root_id;

  INSERT INTO public.bom_version (root_id, version_number, label, status, notes, created_by)
    VALUES (v_root_id, 1, p_label, 'DRAFT', p_notes, auth.uid())
    RETURNING id INTO v_version;

  INSERT INTO public.bom_node (version_id, parent_id, node_type, name, position)
    VALUES (v_version, NULL, 'CONJUNTO', p_name, 0)
    RETURNING id INTO v_node;

  RETURN QUERY SELECT v_root_id, v_version, v_node;
END $$;

-- ============= NODE CRUD =============

CREATE OR REPLACE FUNCTION public.bom_add_node(
  p_version_id  uuid,
  p_parent_id   uuid,
  p_node_type   public.bom_node_type,
  p_name        text    DEFAULT NULL,
  p_material_id uuid    DEFAULT NULL,
  p_quantity    numeric DEFAULT NULL,
  p_position    int     DEFAULT NULL,
  p_notes       text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id  uuid;
  v_pos int;
BEGIN
  PERFORM public.bom_assert_editor();
  PERFORM public.bom_assert_draft(p_version_id);

  IF p_node_type = 'CONJUNTO' THEN
    RAISE EXCEPTION 'Use bom_create_conjunto / bom_new_version to create CONJUNTO nodes';
  END IF;

  IF p_position IS NULL THEN
    SELECT COALESCE(MAX(position) + 1, 0)
      INTO v_pos
      FROM public.bom_node
     WHERE version_id = p_version_id AND parent_id IS NOT DISTINCT FROM p_parent_id;
  ELSE
    v_pos := p_position;
  END IF;

  INSERT INTO public.bom_node
    (version_id, parent_id, node_type, name, material_id, quantity, position, notes)
  VALUES
    (p_version_id, p_parent_id, p_node_type, p_name, p_material_id,
     COALESCE(p_quantity, CASE WHEN p_node_type = 'CONJUNTO' THEN NULL ELSE 1 END),
     v_pos, p_notes)
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.bom_update_node(
  p_node_id  uuid,
  p_name     text    DEFAULT NULL,
  p_quantity numeric DEFAULT NULL,
  p_notes    text    DEFAULT NULL,
  p_position int     DEFAULT NULL,
  p_clear_notes boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_version uuid;
BEGIN
  PERFORM public.bom_assert_editor();
  SELECT version_id INTO v_version FROM public.bom_node WHERE id = p_node_id;
  IF v_version IS NULL THEN RAISE EXCEPTION 'Node % not found', p_node_id; END IF;
  PERFORM public.bom_assert_draft(v_version);

  UPDATE public.bom_node
     SET name     = COALESCE(p_name, name),
         quantity = COALESCE(p_quantity, quantity),
         position = COALESCE(p_position, position),
         notes    = CASE WHEN p_clear_notes THEN NULL ELSE COALESCE(p_notes, notes) END
   WHERE id = p_node_id;
END $$;

CREATE OR REPLACE FUNCTION public.bom_move_node(
  p_node_id      uuid,
  p_new_parent   uuid,
  p_new_position int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_node    public.bom_node;
  v_parent  public.bom_node;
BEGIN
  PERFORM public.bom_assert_editor();

  SELECT * INTO v_node FROM public.bom_node WHERE id = p_node_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Node % not found', p_node_id; END IF;
  PERFORM public.bom_assert_draft(v_node.version_id);

  IF v_node.node_type = 'CONJUNTO' THEN
    RAISE EXCEPTION 'Cannot move the root CONJUNTO';
  END IF;

  IF p_new_parent IS NULL THEN
    RAISE EXCEPTION 'New parent cannot be NULL for non-root nodes';
  END IF;

  SELECT * INTO v_parent FROM public.bom_node WHERE id = p_new_parent;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parent % not found', p_new_parent; END IF;
  IF v_parent.version_id <> v_node.version_id THEN
    RAISE EXCEPTION 'Cannot move across versions';
  END IF;

  -- Cycle and depth checks happen in the bom_validate_node trigger.
  UPDATE public.bom_node
     SET parent_id = p_new_parent,
         position  = p_new_position
   WHERE id = p_node_id;
END $$;

CREATE OR REPLACE FUNCTION public.bom_remove_subtree(p_node_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_node public.bom_node;
BEGIN
  PERFORM public.bom_assert_editor();
  SELECT * INTO v_node FROM public.bom_node WHERE id = p_node_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Node % not found', p_node_id; END IF;
  PERFORM public.bom_assert_draft(v_node.version_id);
  IF v_node.node_type = 'CONJUNTO' THEN
    RAISE EXCEPTION 'Cannot remove the root CONJUNTO; delete the version instead';
  END IF;
  DELETE FROM public.bom_node WHERE id = p_node_id;
END $$;

-- ============= DEEP COPY =============
-- Copies a subtree rooted at p_source_node into p_target_version under
-- p_target_parent. Returns the new top-level node id. The new version
-- must be DRAFT (caller's responsibility). When p_target_parent is NULL
-- the source must be a CONJUNTO and the target version must have no root
-- yet (used by bom_new_version and bom_clone_root).
CREATE OR REPLACE FUNCTION public.bom_copy_subtree(
  p_source_node     uuid,
  p_target_version  uuid,
  p_target_parent   uuid,
  p_position        int DEFAULT 0,
  p_record_origin   boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_new_id  uuid;
  v_child   record;
  v_src     public.bom_node;
BEGIN
  SELECT * INTO v_src FROM public.bom_node WHERE id = p_source_node;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source node % not found', p_source_node; END IF;

  INSERT INTO public.bom_node
    (version_id, parent_id, node_type, material_id, name, quantity, position, notes,
     cloned_from_node_id)
  VALUES
    (p_target_version, p_target_parent, v_src.node_type, v_src.material_id, v_src.name,
     v_src.quantity, p_position, v_src.notes,
     CASE WHEN p_record_origin THEN v_src.id ELSE NULL END)
  RETURNING id INTO v_new_id;

  FOR v_child IN
    SELECT id, position FROM public.bom_node
     WHERE parent_id = p_source_node
     ORDER BY position, created_at
  LOOP
    PERFORM public.bom_copy_subtree(v_child.id, p_target_version, v_new_id,
                                    v_child.position, p_record_origin);
  END LOOP;

  RETURN v_new_id;
END $$;

CREATE OR REPLACE FUNCTION public.bom_duplicate_subtree(p_node_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_node    public.bom_node;
  v_new_pos int;
  v_new_id  uuid;
BEGIN
  PERFORM public.bom_assert_editor();
  SELECT * INTO v_node FROM public.bom_node WHERE id = p_node_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Node % not found', p_node_id; END IF;
  PERFORM public.bom_assert_draft(v_node.version_id);

  IF v_node.node_type = 'CONJUNTO' THEN
    RAISE EXCEPTION 'Cannot duplicate a CONJUNTO inside the same version (use bom_new_version)';
  END IF;

  SELECT COALESCE(MAX(position) + 1, 0)
    INTO v_new_pos
    FROM public.bom_node
   WHERE version_id = v_node.version_id AND parent_id = v_node.parent_id;

  v_new_id := public.bom_copy_subtree(p_node_id, v_node.version_id, v_node.parent_id, v_new_pos, false);
  RETURN v_new_id;
END $$;

-- ============= VERSIONING =============

CREATE OR REPLACE FUNCTION public.bom_new_version(
  p_root_id           uuid,
  p_source_version_id uuid DEFAULT NULL,
  p_label             text DEFAULT NULL,
  p_notes             text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_source uuid := p_source_version_id;
  v_new_version uuid;
  v_next_num int;
  v_root_node uuid;
BEGIN
  PERFORM public.bom_assert_editor();

  IF v_source IS NULL THEN
    SELECT id INTO v_source
      FROM public.bom_version
     WHERE root_id = p_root_id
     ORDER BY version_number DESC
     LIMIT 1;
  ELSE
    PERFORM 1 FROM public.bom_version WHERE id = v_source AND root_id = p_root_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Source version % does not belong to root %', v_source, p_root_id;
    END IF;
  END IF;

  SELECT COALESCE(MAX(version_number) + 1, 1)
    INTO v_next_num FROM public.bom_version WHERE root_id = p_root_id;

  INSERT INTO public.bom_version
    (root_id, version_number, label, status, notes, created_by, cloned_from_version_id)
  VALUES
    (p_root_id, v_next_num, p_label, 'DRAFT', p_notes, auth.uid(), v_source)
  RETURNING id INTO v_new_version;

  IF v_source IS NOT NULL THEN
    SELECT id INTO v_root_node
      FROM public.bom_node
     WHERE version_id = v_source AND parent_id IS NULL;
    IF v_root_node IS NOT NULL THEN
      PERFORM public.bom_copy_subtree(v_root_node, v_new_version, NULL, 0, false);
    END IF;
  END IF;

  RETURN v_new_version;
END $$;

CREATE OR REPLACE FUNCTION public.bom_release_version(p_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_status public.bom_version_status;
BEGIN
  PERFORM public.bom_assert_editor();
  SELECT status INTO v_status FROM public.bom_version WHERE id = p_version_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Version % not found', p_version_id; END IF;
  IF v_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Only DRAFT versions can be released (current status: %)', v_status;
  END IF;
  -- Status guard trigger demotes the previous RELEASED version.
  UPDATE public.bom_version SET status = 'RELEASED' WHERE id = p_version_id;
END $$;

CREATE OR REPLACE FUNCTION public.bom_obsolete_version(p_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM public.bom_assert_editor();
  UPDATE public.bom_version SET status = 'OBSOLETE' WHERE id = p_version_id;
END $$;

-- ============= CLONE BETWEEN PROJECTS =============

CREATE OR REPLACE FUNCTION public.bom_clone_root(
  p_source_version_id uuid,
  p_target_project_id uuid,
  p_codigo            text,
  p_name              text,
  p_label             text DEFAULT NULL,
  p_notes             text DEFAULT NULL
)
RETURNS TABLE (root_id uuid, version_id uuid, root_node_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_source_version public.bom_version;
  v_source_root    uuid;
  v_new_root       uuid;
  v_new_version    uuid;
  v_new_node       uuid;
  v_src_root_node  uuid;
BEGIN
  PERFORM public.bom_assert_editor();

  SELECT * INTO v_source_version FROM public.bom_version WHERE id = p_source_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source version % not found', p_source_version_id; END IF;
  v_source_root := v_source_version.root_id;

  SELECT id INTO v_src_root_node
    FROM public.bom_node WHERE version_id = p_source_version_id AND parent_id IS NULL;
  IF v_src_root_node IS NULL THEN
    RAISE EXCEPTION 'Source version has no root node';
  END IF;

  INSERT INTO public.bom_root (project_id, codigo, name, created_by, cloned_from_root_id)
    VALUES (p_target_project_id, p_codigo, p_name, auth.uid(), v_source_root)
    RETURNING id INTO v_new_root;

  INSERT INTO public.bom_version
    (root_id, version_number, label, status, notes, created_by, cloned_from_version_id)
  VALUES
    (v_new_root, 1, p_label, 'DRAFT', p_notes, auth.uid(), p_source_version_id)
  RETURNING id INTO v_new_version;

  v_new_node := public.bom_copy_subtree(v_src_root_node, v_new_version, NULL, 0, true);

  -- Override the root node name with the requested one (the subtree copy used
  -- the source name).
  UPDATE public.bom_node SET name = p_name WHERE id = v_new_node;

  RETURN QUERY SELECT v_new_root, v_new_version, v_new_node;
END $$;

-- ============= DIFF =============

CREATE OR REPLACE FUNCTION public.bom_diff_versions(
  p_version_a uuid,
  p_version_b uuid
)
RETURNS TABLE (
  change       text,        -- ADDED | REMOVED | QUANTITY_CHANGED
  node_type    public.bom_node_type,
  material_id  uuid,
  name_a       text,
  name_b       text,
  quantity_a   numeric,
  quantity_b   numeric
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH a AS (
    SELECT node_type, material_id, name, quantity
      FROM public.bom_node WHERE version_id = p_version_a
  ),
  b AS (
    SELECT node_type, material_id, name, quantity
      FROM public.bom_node WHERE version_id = p_version_b
  ),
  -- Identity for ITEM = material_id; for SUBCONJUNTO/CONJUNTO = name (within node_type).
  norm_a AS (
    SELECT node_type,
           CASE WHEN node_type = 'ITEM' THEN material_id::text ELSE name END AS key,
           material_id, name, SUM(quantity) AS qty
      FROM a GROUP BY node_type, key, material_id, name
  ),
  norm_b AS (
    SELECT node_type,
           CASE WHEN node_type = 'ITEM' THEN material_id::text ELSE name END AS key,
           material_id, name, SUM(quantity) AS qty
      FROM b GROUP BY node_type, key, material_id, name
  )
  SELECT 'ADDED'::text, b.node_type, b.material_id, NULL::text, b.name, NULL::numeric, b.qty
    FROM norm_b b LEFT JOIN norm_a a USING (node_type, key) WHERE a.key IS NULL
  UNION ALL
  SELECT 'REMOVED', a.node_type, a.material_id, a.name, NULL, a.qty, NULL
    FROM norm_a a LEFT JOIN norm_b b USING (node_type, key) WHERE b.key IS NULL
  UNION ALL
  SELECT 'QUANTITY_CHANGED', a.node_type, a.material_id, a.name, b.name, a.qty, b.qty
    FROM norm_a a JOIN norm_b b USING (node_type, key)
   WHERE a.qty IS DISTINCT FROM b.qty;
$$;

-- ============= GRANTS =============

GRANT EXECUTE ON FUNCTION public.bom_create_conjunto(uuid, text, text, text, text)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.bom_add_node(uuid, uuid, public.bom_node_type, text, uuid, numeric, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bom_update_node(uuid, text, numeric, text, int, boolean)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.bom_move_node(uuid, uuid, int)                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.bom_remove_subtree(uuid)                                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.bom_duplicate_subtree(uuid)                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.bom_new_version(uuid, uuid, text, text)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.bom_release_version(uuid)                                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.bom_obsolete_version(uuid)                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.bom_clone_root(uuid, uuid, text, text, text, text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.bom_diff_versions(uuid, uuid)                             TO authenticated;

-- bom_copy_subtree is an internal helper; do not expose to authenticated.
REVOKE EXECUTE ON FUNCTION public.bom_copy_subtree(uuid, uuid, uuid, int, boolean) FROM PUBLIC, anon, authenticated;

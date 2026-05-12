-- Fix ambiguous column reference "version_id" in bom_clone_root.
-- The RETURNS TABLE declaration creates a PL/pgSQL output variable named
-- version_id, which conflicts with the same-named column in bom_node.
-- Qualifying the column with the table name resolves the ambiguity.

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
  v_source_version RECORD;
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

  SELECT n.id INTO v_src_root_node
    FROM public.bom_node n WHERE n.version_id = p_source_version_id AND n.parent_id IS NULL;
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

  UPDATE public.bom_node SET name = p_name WHERE id = v_new_node;

  RETURN QUERY SELECT v_new_root, v_new_version, v_new_node;
END $$;

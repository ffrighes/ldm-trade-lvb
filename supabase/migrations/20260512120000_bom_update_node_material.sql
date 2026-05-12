-- Extend bom_update_node to support changing the linked material and
-- clearing the node name (for ITEM nodes whose `name` doubles as a TAG).

CREATE OR REPLACE FUNCTION public.bom_update_node(
  p_node_id     uuid,
  p_name        text    DEFAULT NULL,
  p_quantity    numeric DEFAULT NULL,
  p_notes       text    DEFAULT NULL,
  p_position    int     DEFAULT NULL,
  p_clear_notes boolean DEFAULT false,
  p_material_id uuid    DEFAULT NULL,
  p_clear_name  boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_version  uuid;
  v_type     public.bom_node_type;
BEGIN
  PERFORM public.bom_assert_editor();
  SELECT version_id, node_type INTO v_version, v_type
    FROM public.bom_node WHERE id = p_node_id;
  IF v_version IS NULL THEN RAISE EXCEPTION 'Node % not found', p_node_id; END IF;
  PERFORM public.bom_assert_draft(v_version);

  IF p_material_id IS NOT NULL AND v_type <> 'ITEM' THEN
    RAISE EXCEPTION 'material_id can only be set on ITEM nodes';
  END IF;

  IF p_material_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.materials WHERE id = p_material_id) THEN
    RAISE EXCEPTION 'Material % not found', p_material_id;
  END IF;

  UPDATE public.bom_node
     SET name        = CASE WHEN p_clear_name THEN NULL
                            ELSE COALESCE(p_name, name) END,
         quantity    = COALESCE(p_quantity, quantity),
         position    = COALESCE(p_position, position),
         notes       = CASE WHEN p_clear_notes THEN NULL
                            ELSE COALESCE(p_notes, notes) END,
         material_id = COALESCE(p_material_id, material_id)
   WHERE id = p_node_id;
END $$;

GRANT EXECUTE ON FUNCTION public.bom_update_node(uuid, text, numeric, text, int, boolean, uuid, boolean)
  TO authenticated;

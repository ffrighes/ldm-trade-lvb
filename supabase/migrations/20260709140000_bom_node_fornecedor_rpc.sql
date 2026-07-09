-- Estende bom_add_node e bom_update_node para aceitar fornecedor_id, para
-- que a vinculação de fornecedor a um item da LDM (bom_node.fornecedor_id,
-- adicionada em 20260709130000) possa ser definida via RPC, único caminho
-- de escrita em bom_node.
--
-- CREATE OR REPLACE não substitui uma função de assinatura diferente (cria
-- um overload); as versões antigas são removidas explicitamente primeiro.
DROP FUNCTION IF EXISTS public.bom_add_node(uuid, uuid, public.bom_node_type, text, uuid, numeric, int, text);
DROP FUNCTION IF EXISTS public.bom_update_node(uuid, text, numeric, text, int, boolean, uuid, boolean);

CREATE OR REPLACE FUNCTION public.bom_add_node(
  p_version_id    uuid,
  p_parent_id     uuid,
  p_node_type     public.bom_node_type,
  p_name          text    DEFAULT NULL,
  p_material_id   uuid    DEFAULT NULL,
  p_quantity      numeric DEFAULT NULL,
  p_position      int     DEFAULT NULL,
  p_notes         text    DEFAULT NULL,
  p_fornecedor_id uuid    DEFAULT NULL
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
    (version_id, parent_id, node_type, name, material_id, quantity, position, notes, fornecedor_id)
  VALUES
    (p_version_id, p_parent_id, p_node_type, p_name, p_material_id,
     COALESCE(p_quantity, CASE WHEN p_node_type = 'CONJUNTO' THEN NULL ELSE 1 END),
     v_pos, p_notes, p_fornecedor_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.bom_update_node(
  p_node_id       uuid,
  p_name          text    DEFAULT NULL,
  p_quantity      numeric DEFAULT NULL,
  p_notes         text    DEFAULT NULL,
  p_position      int     DEFAULT NULL,
  p_clear_notes   boolean DEFAULT false,
  p_material_id   uuid    DEFAULT NULL,
  p_clear_name    boolean DEFAULT false,
  p_fornecedor_id uuid    DEFAULT NULL,
  p_clear_fornecedor boolean DEFAULT false
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
         material_id = COALESCE(p_material_id, material_id),
         fornecedor_id = CASE WHEN p_clear_fornecedor THEN NULL
                              ELSE COALESCE(p_fornecedor_id, fornecedor_id) END
   WHERE id = p_node_id;
END $$;

GRANT EXECUTE ON FUNCTION public.bom_add_node(uuid, uuid, public.bom_node_type, text, uuid, numeric, int, text, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.bom_update_node(uuid, text, numeric, text, int, boolean, uuid, boolean, uuid, boolean)
  TO authenticated;

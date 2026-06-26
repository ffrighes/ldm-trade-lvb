-- Batch BOM operations: atomic multi-node remove / move / set-quantity.
--
-- Each function runs inside a single transaction (the plpgsql function body),
-- so a failure on any element rolls the whole batch back — no half-applied
-- state. They reuse the existing bom_assert_editor / bom_assert_draft guards,
-- and the per-row bom_node validation/audit triggers still fire for every
-- affected row. Operations are idempotent: removing an already-removed node,
-- moving a node that is already under the target, or re-applying the same
-- quantity are all no-ops rather than errors.

-- ============= BATCH REMOVE =============

CREATE OR REPLACE FUNCTION public.bom_batch_remove_subtrees(p_node_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_node  public.bom_node;
  v_id    uuid;
  v_count integer := 0;
BEGIN
  PERFORM public.bom_assert_editor();

  IF p_node_ids IS NULL OR array_length(p_node_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Validate every node up front so the whole batch aborts (rolls back)
  -- before any row is deleted if a single one is ineligible.
  FOREACH v_id IN ARRAY p_node_ids LOOP
    SELECT * INTO v_node FROM public.bom_node WHERE id = v_id;
    IF NOT FOUND THEN
      CONTINUE; -- already gone: idempotent skip
    END IF;
    PERFORM public.bom_assert_draft(v_node.version_id);
    IF v_node.node_type = 'CONJUNTO' THEN
      RAISE EXCEPTION 'Cannot remove the root CONJUNTO; delete the version instead';
    END IF;
  END LOOP;

  -- ON DELETE CASCADE on bom_node.parent_id removes descendants of any
  -- node deleted here, so nested selections are handled automatically.
  DELETE FROM public.bom_node WHERE id = ANY(p_node_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- ============= BATCH MOVE =============

CREATE OR REPLACE FUNCTION public.bom_batch_move_nodes(
  p_node_ids   uuid[],
  p_new_parent uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_parent        public.bom_node;
  v_node          public.bom_node;
  v_id            uuid;
  v_pos           int;
  v_count         integer := 0;
  v_is_ancestor   boolean;
BEGIN
  PERFORM public.bom_assert_editor();

  IF p_new_parent IS NULL THEN
    RAISE EXCEPTION 'New parent cannot be NULL';
  END IF;

  SELECT * INTO v_parent FROM public.bom_node WHERE id = p_new_parent;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parent % not found', p_new_parent; END IF;
  PERFORM public.bom_assert_draft(v_parent.version_id);
  IF v_parent.node_type = 'ITEM' THEN
    RAISE EXCEPTION 'Items cannot have children';
  END IF;

  IF p_node_ids IS NULL OR array_length(p_node_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Append the moved nodes after the target's current children.
  SELECT COALESCE(MAX(position) + 1, 0) INTO v_pos
    FROM public.bom_node
   WHERE version_id = v_parent.version_id AND parent_id = p_new_parent;

  FOREACH v_id IN ARRAY p_node_ids LOOP
    SELECT * INTO v_node FROM public.bom_node WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Node % not found', v_id; END IF;
    PERFORM public.bom_assert_draft(v_node.version_id);

    IF v_node.node_type = 'CONJUNTO' THEN
      RAISE EXCEPTION 'Cannot move the root CONJUNTO';
    END IF;
    IF v_node.version_id <> v_parent.version_id THEN
      RAISE EXCEPTION 'Cannot move across versions';
    END IF;
    IF v_id = p_new_parent THEN
      RAISE EXCEPTION 'Cannot move a node into itself';
    END IF;

    -- Reject moving a node into one of its own descendants (cycle): walk up
    -- from the target parent and ensure we never reach the node being moved.
    WITH RECURSIVE up AS (
      SELECT id, parent_id FROM public.bom_node WHERE id = p_new_parent
      UNION ALL
      SELECT n.id, n.parent_id
        FROM public.bom_node n JOIN up ON n.id = up.parent_id
    )
    SELECT EXISTS(SELECT 1 FROM up WHERE id = v_id) INTO v_is_ancestor;
    IF v_is_ancestor THEN
      RAISE EXCEPTION 'Cannot move a node into its own subtree';
    END IF;

    -- Already under the target → idempotent skip (keeps existing position).
    IF v_node.parent_id IS DISTINCT FROM p_new_parent THEN
      UPDATE public.bom_node
         SET parent_id = p_new_parent, position = v_pos
       WHERE id = v_id;
      v_pos   := v_pos + 1;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END $$;

-- ============= BATCH SET QUANTITY =============

CREATE OR REPLACE FUNCTION public.bom_batch_set_quantity(
  p_node_ids uuid[],
  p_quantity numeric
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_node  public.bom_node;
  v_id    uuid;
  v_count integer := 0;
BEGIN
  PERFORM public.bom_assert_editor();

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;
  IF p_node_ids IS NULL OR array_length(p_node_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  FOREACH v_id IN ARRAY p_node_ids LOOP
    SELECT * INTO v_node FROM public.bom_node WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Node % not found', v_id; END IF;
    PERFORM public.bom_assert_draft(v_node.version_id);
    IF v_node.node_type = 'CONJUNTO' THEN
      RAISE EXCEPTION 'CONJUNTO root has no quantity';
    END IF;
  END LOOP;

  UPDATE public.bom_node
     SET quantity = p_quantity
   WHERE id = ANY(p_node_ids) AND node_type <> 'CONJUNTO';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- ============= GRANTS =============

GRANT EXECUTE ON FUNCTION public.bom_batch_remove_subtrees(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bom_batch_move_nodes(uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bom_batch_set_quantity(uuid[], numeric) TO authenticated;

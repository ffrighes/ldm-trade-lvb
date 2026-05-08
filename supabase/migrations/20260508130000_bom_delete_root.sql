-- bom_delete_root: cascading delete of a Conjunto and all its versions/nodes.
--
-- A plain DELETE on bom_root cascades to bom_version → bom_node, but the
-- bom_guard_non_draft trigger on bom_node would block cascade deletes for
-- nodes that belong to RELEASED/OBSOLETE versions. This RPC sets the
-- internal bypass GUC for the duration of the call so the cascade can
-- proceed. Restricted to admin/gerente.

CREATE OR REPLACE FUNCTION public.bom_delete_root(p_root_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente')) THEN
    RAISE EXCEPTION 'Permission denied: only admin or gerente can delete a Conjunto';
  END IF;

  PERFORM 1 FROM public.bom_root WHERE id = p_root_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conjunto % not found', p_root_id;
  END IF;

  PERFORM set_config('app.bom_allow_non_draft_write', 'on', true);
  DELETE FROM public.bom_root WHERE id = p_root_id;
  PERFORM set_config('app.bom_allow_non_draft_write', '', true);
END $$;

GRANT EXECUTE ON FUNCTION public.bom_delete_root(uuid) TO authenticated;

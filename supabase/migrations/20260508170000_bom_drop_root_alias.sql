-- Workaround for a persistent gateway-level "No API key found / 409"
-- error when calling rpc/bom_delete_root from the browser. The function
-- itself is correct and works server-side, but the specific request
-- pathway (path or void return) appears to clash with something between
-- the browser and the database in the user's environment.
--
-- This migration introduces a new RPC `bom_drop_root` with two changes:
--   * different name (avoids any path-keyed cache or rule attached to
--     `bom_delete_root`)
--   * returns jsonb instead of void (avoids any intermediary that
--     mishandles 204 No Content responses)
--
-- The legacy bom_delete_root is kept as a thin wrapper so any existing
-- caller continues to work.

CREATE OR REPLACE FUNCTION public.bom_drop_root(p_root_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role public.app_role;
BEGIN
  v_role := public.get_user_role(auth.uid());
  IF v_role IS NULL OR v_role NOT IN ('admin', 'gerente') THEN
    RAISE EXCEPTION 'Permission denied: only admin or gerente can delete a Conjunto';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bom_root WHERE id = p_root_id) THEN
    RAISE EXCEPTION 'Conjunto % not found', p_root_id;
  END IF;

  PERFORM set_config('app.bom_deleting_root', 'on', true);
  PERFORM set_config('app.bom_allow_non_draft_write', 'on', true);

  DELETE FROM public.bom_root WHERE id = p_root_id;

  RETURN jsonb_build_object('deleted_root_id', p_root_id);
END $$;

GRANT EXECUTE ON FUNCTION public.bom_drop_root(uuid) TO authenticated;

-- Keep bom_delete_root callable for any pre-existing client, delegating
-- to the new function so we have a single source of truth.
CREATE OR REPLACE FUNCTION public.bom_delete_root(p_root_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM public.bom_drop_root(p_root_id);
END $$;

GRANT EXECUTE ON FUNCTION public.bom_delete_root(uuid) TO authenticated;

-- Hotfix: ensure bom_delete_root works regardless of has_role grant state.
--
-- Even though earlier migrations grant EXECUTE on public.has_role to
-- authenticated/anon, environments that recreate the BOM functions
-- before the grant takes effect can still hit "permission denied for
-- function has_role" surfaces (which sometimes get translated to
-- generic gateway errors like "No API key found" / 409 by the
-- intermediaries).
--
-- This migration:
--   1. Re-grants EXECUTE on has_role / get_user_role idempotently
--      (covers both the original signature and any drift), and to
--      service_role for completeness.
--   2. Rewrites bom_delete_root to use get_user_role (which is the
--      only one strictly required by the RLS-free SECURITY DEFINER
--      path) instead of has_role.

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid)
  TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.bom_delete_root(p_root_id uuid)
RETURNS void
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

  -- Both flags are honored by the bom_version / bom_node BEFORE DELETE
  -- triggers added in 20260508140000.
  PERFORM set_config('app.bom_deleting_root', 'on', true);
  PERFORM set_config('app.bom_allow_non_draft_write', 'on', true);

  DELETE FROM public.bom_root WHERE id = p_root_id;
END $$;

GRANT EXECUTE ON FUNCTION public.bom_delete_root(uuid) TO authenticated;

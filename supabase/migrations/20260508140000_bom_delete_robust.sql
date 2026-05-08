-- Hotfix: make Conjunto deletion robust regardless of caller path.
--
-- Previously bom_delete_root set the bypass GUC manually before deleting
-- the root. If anything went wrong with that GUC plumbing (or if a delete
-- was initiated through a different path), the cascade to bom_node could
-- fail because the bom_guard_non_draft trigger blocks DELETEs on nodes
-- that belong to non-DRAFT versions.
--
-- This migration moves the bypass into a BEFORE DELETE trigger on
-- bom_version itself: whenever a version row is being deleted (directly
-- or via cascade from bom_root), the bypass GUC is set transaction-locally
-- so the subsequent cascade to bom_node can proceed.
--
-- It also adds a guard preventing direct DELETE of non-DRAFT versions
-- via the API: that path is reserved for bom_delete_root, which signals
-- intent via a separate GUC.

-- 1. Direct-delete guard on bom_version (must run BEFORE the marker so
--    it can short-circuit). Allow any delete when called from inside
--    bom_delete_root (signaled by app.bom_deleting_root = 'on').
CREATE OR REPLACE FUNCTION public.bom_version_guard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE v_root_delete text;
BEGIN
  v_root_delete := current_setting('app.bom_deleting_root', true);
  IF v_root_delete = 'on' THEN
    RETURN OLD;
  END IF;
  IF OLD.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Cannot delete % version %; obsolete it or delete the Conjunto', OLD.status, OLD.id;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_bom_version_guard_delete ON public.bom_version;
CREATE TRIGGER trg_bom_version_guard_delete
  BEFORE DELETE ON public.bom_version
  FOR EACH ROW EXECUTE FUNCTION public.bom_version_guard_delete();

-- 2. Marker trigger: enable the node-bypass GUC so the cascade to
--    bom_node is allowed for this transaction. Trigger names are sorted
--    alphabetically; "guard_delete" < "mark_deleting", so guard_delete
--    runs first and can still block the operation.
CREATE OR REPLACE FUNCTION public.bom_version_mark_deleting()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.bom_allow_non_draft_write', 'on', true);
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_bom_version_mark_deleting ON public.bom_version;
CREATE TRIGGER trg_bom_version_mark_deleting
  BEFORE DELETE ON public.bom_version
  FOR EACH ROW EXECUTE FUNCTION public.bom_version_mark_deleting();

-- 3. Replace bom_delete_root to set the root-deleting flag, the node
--    bypass, and then cascade. The cascade now also goes through the
--    triggers above, so even a direct DELETE on bom_root would be
--    handled correctly.
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

  IF NOT EXISTS (SELECT 1 FROM public.bom_root WHERE id = p_root_id) THEN
    RAISE EXCEPTION 'Conjunto % not found', p_root_id;
  END IF;

  PERFORM set_config('app.bom_deleting_root', 'on', true);
  PERFORM set_config('app.bom_allow_non_draft_write', 'on', true);
  DELETE FROM public.bom_root WHERE id = p_root_id;
END $$;

GRANT EXECUTE ON FUNCTION public.bom_delete_root(uuid) TO authenticated;

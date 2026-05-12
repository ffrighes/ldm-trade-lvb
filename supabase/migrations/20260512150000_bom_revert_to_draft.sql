-- Allow reverting an OBSOLETE version back to DRAFT.
--
-- The existing bom_version_status_guard trigger blocks all OBSOLETE → *
-- transitions unconditionally. This migration:
--   1. Replaces the guard to allow the transition when the session GUC
--      app.bom_reverting_to_draft = 'on' is set.
--   2. Adds bom_revert_version_to_draft(p_version_id uuid) — a SECURITY
--      DEFINER RPC (admin/gerente only) that sets the GUC, clears
--      obsoleted_at, and moves the status to DRAFT.
--
-- Returns jsonb (not void) to avoid gateway 204 No Content issues.

-- 1. Replace the status guard to honour the bypass GUC.
CREATE OR REPLACE FUNCTION public.bom_version_status_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE v_reverting text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'OBSOLETE' AND NEW.status <> 'OBSOLETE' THEN
      v_reverting := current_setting('app.bom_reverting_to_draft', true);
      IF v_reverting <> 'on' THEN
        RAISE EXCEPTION 'OBSOLETE versions are immutable';
      END IF;
    END IF;
    IF OLD.status = 'RELEASED' AND NEW.status = 'DRAFT' THEN
      RAISE EXCEPTION 'Cannot move RELEASED back to DRAFT';
    END IF;
  END IF;

  IF NEW.status = 'RELEASED' AND (TG_OP = 'INSERT' OR OLD.status <> 'RELEASED') THEN
    NEW.released_at := COALESCE(NEW.released_at, now());
    UPDATE public.bom_version
       SET status = 'OBSOLETE', obsoleted_at = now()
     WHERE root_id = NEW.root_id
       AND status = 'RELEASED'
       AND id <> NEW.id;
  ELSIF NEW.status = 'OBSOLETE' AND (TG_OP = 'INSERT' OR OLD.status <> 'OBSOLETE') THEN
    NEW.obsoleted_at := COALESCE(NEW.obsoleted_at, now());
  ELSIF NEW.status = 'DRAFT' AND OLD.status = 'OBSOLETE' THEN
    NEW.obsoleted_at := NULL;
  END IF;

  RETURN NEW;
END $$;

-- 2. RPC: revert an OBSOLETE version to DRAFT.
CREATE OR REPLACE FUNCTION public.bom_revert_version_to_draft(p_version_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role    public.app_role;
  v_version public.bom_version%ROWTYPE;
BEGIN
  v_role := public.get_user_role(auth.uid());
  IF v_role IS NULL OR v_role NOT IN ('admin', 'gerente') THEN
    RAISE EXCEPTION 'Permission denied: only admin or gerente can revert a version to DRAFT';
  END IF;

  SELECT * INTO v_version FROM public.bom_version WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version % not found', p_version_id;
  END IF;

  IF v_version.status <> 'OBSOLETE' THEN
    RAISE EXCEPTION 'Only OBSOLETE versions can be reverted to DRAFT (version % is %)',
      p_version_id, v_version.status;
  END IF;

  PERFORM set_config('app.bom_reverting_to_draft', 'on', true);

  UPDATE public.bom_version
     SET status = 'DRAFT'
   WHERE id = p_version_id;

  RETURN jsonb_build_object(
    'version_id', p_version_id,
    'root_id',    v_version.root_id,
    'status',     'DRAFT'
  );
END $$;

GRANT EXECUTE ON FUNCTION public.bom_revert_version_to_draft(uuid) TO authenticated;

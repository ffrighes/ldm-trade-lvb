-- Fix: bom_version uses root_id (not bom_root_id) as the FK to bom_root.
-- Replaces the function created in 20260512130000 with the corrected column name.

CREATE OR REPLACE FUNCTION public.bom_drop_obsolete_version(p_version_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role        public.app_role;
  v_version     public.bom_version%ROWTYPE;
  v_max_version integer;
BEGIN
  v_role := public.get_user_role(auth.uid());
  IF v_role IS NULL OR v_role NOT IN ('admin', 'gerente') THEN
    RAISE EXCEPTION 'Permission denied: only admin or gerente can delete a version';
  END IF;

  SELECT * INTO v_version FROM public.bom_version WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version % not found', p_version_id;
  END IF;

  IF v_version.status <> 'OBSOLETE' THEN
    RAISE EXCEPTION 'Only OBSOLETE versions can be deleted (version % is %)',
      p_version_id, v_version.status;
  END IF;

  SELECT MAX(version_number) INTO v_max_version
    FROM public.bom_version
   WHERE root_id = v_version.root_id;

  IF v_version.version_number < v_max_version THEN
    RAISE EXCEPTION
      'Only the highest version can be deleted (v% is not the highest; v% is)',
      v_version.version_number, v_max_version;
  END IF;

  PERFORM set_config('app.bom_deleting_root', 'on', true);
  PERFORM set_config('app.bom_allow_non_draft_write', 'on', true);

  DELETE FROM public.bom_version WHERE id = p_version_id;

  RETURN jsonb_build_object(
    'deleted_version_id', p_version_id,
    'version_number',     v_version.version_number,
    'root_id',            v_version.root_id
  );
END $$;

GRANT EXECUTE ON FUNCTION public.bom_drop_obsolete_version(uuid) TO authenticated;

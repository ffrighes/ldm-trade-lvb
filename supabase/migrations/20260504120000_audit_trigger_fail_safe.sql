-- Hotfix: make the solicitacao audit trigger fail-safe.
--
-- The trigger added in Phase 4 was throwing 403 on INSERT/UPDATE of
-- solicitacoes whenever the audit-table write failed (e.g. RLS denied,
-- function owner without BYPASSRLS, auth.users access blocked, etc.).
-- Because triggers run inside the calling transaction, any error inside
-- the trigger rolls back the whole save.
--
-- Wrapping the audit logic in BEGIN/EXCEPTION makes it best-effort: if
-- the log write fails for any reason we emit a WARNING and let the
-- main save proceed. Audit may be incomplete in that case but the user
-- can still get their work done.

CREATE OR REPLACE FUNCTION public.log_solicitacao_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_email text;
  v_before jsonb;
  v_after jsonb;
  v_changed text[];
BEGIN
  BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
      SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;
    END IF;

    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.solicitacao_audit
        (solicitacao_id, solicitacao_numero, actor_id, actor_email, action, before, after, changed_fields)
      VALUES
        (NEW.id, NEW.numero, v_actor_id, v_actor_email, 'INSERT', NULL, to_jsonb(NEW), NULL);

    ELSIF TG_OP = 'UPDATE' THEN
      v_before := to_jsonb(OLD);
      v_after := to_jsonb(NEW);
      IF v_before IS DISTINCT FROM v_after THEN
        SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::text[])
        INTO v_changed
        FROM (
          SELECT key FROM jsonb_each(v_after)
          WHERE v_before -> key IS DISTINCT FROM v_after -> key
        ) d;

        INSERT INTO public.solicitacao_audit
          (solicitacao_id, solicitacao_numero, actor_id, actor_email, action, before, after, changed_fields)
        VALUES
          (NEW.id, NEW.numero, v_actor_id, v_actor_email, 'UPDATE', v_before, v_after, v_changed);
      END IF;

    ELSIF TG_OP = 'DELETE' THEN
      INSERT INTO public.solicitacao_audit
        (solicitacao_id, solicitacao_numero, actor_id, actor_email, action, before, after, changed_fields)
      VALUES
        (NULL, OLD.numero, v_actor_id, v_actor_email, 'DELETE', to_jsonb(OLD), NULL, NULL);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Audit log skipped: %', SQLERRM;
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

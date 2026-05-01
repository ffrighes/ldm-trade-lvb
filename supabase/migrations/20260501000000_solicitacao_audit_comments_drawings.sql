-- Phase 4: audit trail, comments and multi-revision drawings.
--
-- 1. solicitacao_audit + trigger: captures every INSERT/UPDATE/DELETE on
--    solicitacoes with actor_id (auth.uid()), actor_email snapshot, the
--    full before/after JSON and the list of changed fields.
-- 2. solicitacao_comments: free-text notes scoped to a solicitação,
--    written by authenticated users; deletable by author or admin/gerente.
-- 3. solicitacao_drawings: multiple PDF revisions per solicitação. The
--    legacy solicitacoes.desenho column is kept untouched for backward
--    compatibility — the UI shows both.

-- ============= AUDIT TRAIL =============

CREATE TABLE IF NOT EXISTS public.solicitacao_audit (
  id bigserial PRIMARY KEY,
  solicitacao_id uuid REFERENCES public.solicitacoes(id) ON DELETE SET NULL,
  solicitacao_numero text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  before jsonb,
  after jsonb,
  changed_fields text[],
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_solicitacao
  ON public.solicitacao_audit (solicitacao_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_at
  ON public.solicitacao_audit (at DESC);

ALTER TABLE public.solicitacao_audit ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated users. No INSERT/UPDATE/DELETE policy means
-- the only writer is the SECURITY DEFINER trigger below (postgres bypasses
-- RLS), so the audit log cannot be tampered with through the API.
DROP POLICY IF EXISTS "audit_select_authenticated" ON public.solicitacao_audit;
CREATE POLICY "audit_select_authenticated"
  ON public.solicitacao_audit
  FOR SELECT
  TO authenticated
  USING (true);

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
  v_actor_id := auth.uid();
  IF v_actor_id IS NOT NULL THEN
    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.solicitacao_audit
      (solicitacao_id, solicitacao_numero, actor_id, actor_email, action, before, after, changed_fields)
    VALUES
      (NEW.id, NEW.numero, v_actor_id, v_actor_email, 'INSERT', NULL, to_jsonb(NEW), NULL);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    IF v_before IS DISTINCT FROM v_after THEN
      SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::text[])
      INTO v_changed
      FROM (
        SELECT key
        FROM jsonb_each(v_after)
        WHERE v_before -> key IS DISTINCT FROM v_after -> key
      ) d;

      INSERT INTO public.solicitacao_audit
        (solicitacao_id, solicitacao_numero, actor_id, actor_email, action, before, after, changed_fields)
      VALUES
        (NEW.id, NEW.numero, v_actor_id, v_actor_email, 'UPDATE', v_before, v_after, v_changed);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.solicitacao_audit
      (solicitacao_id, solicitacao_numero, actor_id, actor_email, action, before, after, changed_fields)
    VALUES
      (NULL, OLD.numero, v_actor_id, v_actor_email, 'DELETE', to_jsonb(OLD), NULL, NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_solicitacoes ON public.solicitacoes;
CREATE TRIGGER trg_audit_solicitacoes
  AFTER INSERT OR UPDATE OR DELETE ON public.solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.log_solicitacao_audit();

-- ============= COMMENTS =============

CREATE TABLE IF NOT EXISTS public.solicitacao_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email text NOT NULL,
  body text NOT NULL CHECK (length(trim(body)) > 0 AND length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_solicitacao
  ON public.solicitacao_comments (solicitacao_id, created_at DESC);

ALTER TABLE public.solicitacao_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select_authenticated" ON public.solicitacao_comments;
CREATE POLICY "comments_select_authenticated"
  ON public.solicitacao_comments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "comments_insert_self" ON public.solicitacao_comments;
CREATE POLICY "comments_insert_self"
  ON public.solicitacao_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "comments_delete_own_or_admin" ON public.solicitacao_comments;
CREATE POLICY "comments_delete_own_or_admin"
  ON public.solicitacao_comments
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
  );

-- ============= DRAWINGS (multi-revision) =============

CREATE TABLE IF NOT EXISTS public.solicitacao_drawings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes(id) ON DELETE CASCADE,
  revisao text NOT NULL DEFAULT '',
  url text NOT NULL,
  storage_path text,
  notas text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_email text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drawings_solicitacao
  ON public.solicitacao_drawings (solicitacao_id, uploaded_at DESC);

ALTER TABLE public.solicitacao_drawings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drawings_select_authenticated" ON public.solicitacao_drawings;
CREATE POLICY "drawings_select_authenticated"
  ON public.solicitacao_drawings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "drawings_insert_self" ON public.solicitacao_drawings;
CREATE POLICY "drawings_insert_self"
  ON public.solicitacao_drawings
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "drawings_delete_own_or_admin" ON public.solicitacao_drawings;
CREATE POLICY "drawings_delete_own_or_admin"
  ON public.solicitacao_drawings
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'projetista')
  );

-- Hotfix: Phase 4 audit trigger was failing with 403 because the audit
-- table has RLS enabled with no INSERT policy. The SECURITY DEFINER on
-- the trigger function is not enough on Supabase Cloud — the function
-- owner does not always have BYPASSRLS.
--
-- Adding an INSERT policy that allows any authenticated user is safe:
-- the trigger is the only writer in the application code (no API call
-- inserts into solicitacao_audit), so this only unblocks the trigger.

DROP POLICY IF EXISTS "audit_insert_authenticated" ON public.solicitacao_audit;
CREATE POLICY "audit_insert_authenticated"
  ON public.solicitacao_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Hotfix: restore EXECUTE on has_role / get_user_role for authenticated and
-- anon so RLS policies that invoke these functions can be evaluated.
--
-- A prior security migration (20260430115959) revoked EXECUTE from public,
-- anon and authenticated for hardening reasons. However, the RLS policies
-- on bom_root, bom_version, bom_node, bom_drawings and bom_comments call
-- public.has_role(auth.uid(), '<role>') inline; the RLS engine evaluates
-- those USING/WITH CHECK clauses with the privileges of the calling role,
-- so it needs EXECUTE permission on the function.
--
-- Without this GRANT, every write on the BOM tables surfaces as a generic
-- 4xx at the gateway (the API request is rejected before reaching the
-- intended logic), which is what produced the "No API key found / 409"
-- failure when deleting a Conjunto.

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid)             TO authenticated, anon;

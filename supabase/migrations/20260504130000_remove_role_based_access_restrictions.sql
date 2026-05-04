-- ============================================================================
-- Remove role-based access restrictions
--
-- Drops the role-gated RLS policies introduced in
-- 20260430115943_e896e3f6-19c5-4695-8f7c-bc4d1270ff6a.sql and
-- 20260501000000_solicitacao_audit_comments_drawings.sql
-- and replaces them with policies that grant full CRUD access to any
-- authenticated user.
-- ============================================================================

-- ============= PROFILES =============
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

CREATE POLICY "Authenticated can read profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- ============= MATERIALS =============
DROP POLICY IF EXISTS "Authenticated can read materials" ON public.materials;
DROP POLICY IF EXISTS "Privileged can insert materials" ON public.materials;
DROP POLICY IF EXISTS "Privileged can update materials" ON public.materials;
DROP POLICY IF EXISTS "Admins/gerentes can delete materials" ON public.materials;

CREATE POLICY "Authenticated can read materials"
ON public.materials FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert materials"
ON public.materials FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update materials"
ON public.materials FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete materials"
ON public.materials FOR DELETE TO authenticated USING (true);

-- ============= PROJECTS =============
DROP POLICY IF EXISTS "Authenticated can read projects" ON public.projects;
DROP POLICY IF EXISTS "Privileged can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Privileged can update projects" ON public.projects;
DROP POLICY IF EXISTS "Admins/gerentes can delete projects" ON public.projects;

CREATE POLICY "Authenticated can read projects"
ON public.projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert projects"
ON public.projects FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update projects"
ON public.projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete projects"
ON public.projects FOR DELETE TO authenticated USING (true);

-- ============= SOLICITACOES =============
DROP POLICY IF EXISTS "Authenticated can read solicitacoes" ON public.solicitacoes;
DROP POLICY IF EXISTS "Privileged can insert solicitacoes" ON public.solicitacoes;
DROP POLICY IF EXISTS "Privileged can update solicitacoes" ON public.solicitacoes;
DROP POLICY IF EXISTS "Privileged can delete solicitacoes" ON public.solicitacoes;

CREATE POLICY "Authenticated can read solicitacoes"
ON public.solicitacoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert solicitacoes"
ON public.solicitacoes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update solicitacoes"
ON public.solicitacoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete solicitacoes"
ON public.solicitacoes FOR DELETE TO authenticated USING (true);

-- ============= SOLICITACAO_ITENS =============
DROP POLICY IF EXISTS "Authenticated can read solicitacao_itens" ON public.solicitacao_itens;
DROP POLICY IF EXISTS "Privileged can insert solicitacao_itens" ON public.solicitacao_itens;
DROP POLICY IF EXISTS "Privileged can update solicitacao_itens" ON public.solicitacao_itens;
DROP POLICY IF EXISTS "Privileged can delete solicitacao_itens" ON public.solicitacao_itens;

CREATE POLICY "Authenticated can read solicitacao_itens"
ON public.solicitacao_itens FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert solicitacao_itens"
ON public.solicitacao_itens FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update solicitacao_itens"
ON public.solicitacao_itens FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete solicitacao_itens"
ON public.solicitacao_itens FOR DELETE TO authenticated USING (true);

-- ============= INVENTARIO =============
DROP POLICY IF EXISTS "Authenticated can read inventario" ON public.inventario;
DROP POLICY IF EXISTS "Privileged can insert inventario" ON public.inventario;
DROP POLICY IF EXISTS "Privileged can update inventario" ON public.inventario;
DROP POLICY IF EXISTS "Privileged can delete inventario" ON public.inventario;

CREATE POLICY "Authenticated can read inventario"
ON public.inventario FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert inventario"
ON public.inventario FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update inventario"
ON public.inventario FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete inventario"
ON public.inventario FOR DELETE TO authenticated USING (true);

-- ============= SOLICITACAO_COMMENTS =============
DROP POLICY IF EXISTS "comments_select_authenticated" ON public.solicitacao_comments;
DROP POLICY IF EXISTS "comments_insert_self" ON public.solicitacao_comments;
DROP POLICY IF EXISTS "comments_delete_own_or_admin" ON public.solicitacao_comments;

CREATE POLICY "comments_select_authenticated"
ON public.solicitacao_comments
FOR SELECT TO authenticated USING (true);

CREATE POLICY "comments_insert_authenticated"
ON public.solicitacao_comments
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "comments_update_authenticated"
ON public.solicitacao_comments
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "comments_delete_authenticated"
ON public.solicitacao_comments
FOR DELETE TO authenticated USING (true);

-- ============= SOLICITACAO_DRAWINGS =============
DROP POLICY IF EXISTS "drawings_select_authenticated" ON public.solicitacao_drawings;
DROP POLICY IF EXISTS "drawings_insert_self" ON public.solicitacao_drawings;
DROP POLICY IF EXISTS "drawings_delete_own_or_admin" ON public.solicitacao_drawings;

CREATE POLICY "drawings_select_authenticated"
ON public.solicitacao_drawings
FOR SELECT TO authenticated USING (true);

CREATE POLICY "drawings_insert_authenticated"
ON public.solicitacao_drawings
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "drawings_update_authenticated"
ON public.solicitacao_drawings
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "drawings_delete_authenticated"
ON public.solicitacao_drawings
FOR DELETE TO authenticated USING (true);

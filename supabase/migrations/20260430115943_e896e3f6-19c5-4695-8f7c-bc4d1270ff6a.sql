
-- ============= PROFILES: restrict SELECT to self or admin =============
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;

CREATE POLICY "Users can read own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============= MATERIALS =============
DROP POLICY IF EXISTS "Allow all on materials" ON public.materials;

CREATE POLICY "Authenticated can read materials"
ON public.materials FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Privileged can insert materials"
ON public.materials FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'projetista')
);

CREATE POLICY "Privileged can update materials"
ON public.materials FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'projetista')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'projetista')
);

CREATE POLICY "Admins/gerentes can delete materials"
ON public.materials FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
);

-- ============= PROJECTS =============
DROP POLICY IF EXISTS "Allow all on projects" ON public.projects;

CREATE POLICY "Authenticated can read projects"
ON public.projects FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Privileged can insert projects"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'projetista')
);

CREATE POLICY "Privileged can update projects"
ON public.projects FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'projetista')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'projetista')
);

CREATE POLICY "Admins/gerentes can delete projects"
ON public.projects FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
);

-- ============= SOLICITACOES =============
DROP POLICY IF EXISTS "Allow all on solicitacoes" ON public.solicitacoes;

CREATE POLICY "Authenticated can read solicitacoes"
ON public.solicitacoes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Privileged can insert solicitacoes"
ON public.solicitacoes FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'projetista')
  OR public.has_role(auth.uid(), 'coordenador_campo')
);

CREATE POLICY "Privileged can update solicitacoes"
ON public.solicitacoes FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'projetista')
  OR public.has_role(auth.uid(), 'comprador')
  OR public.has_role(auth.uid(), 'coordenador_campo')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'projetista')
  OR public.has_role(auth.uid(), 'comprador')
  OR public.has_role(auth.uid(), 'coordenador_campo')
);

CREATE POLICY "Privileged can delete solicitacoes"
ON public.solicitacoes FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'coordenador_campo')
);

-- ============= SOLICITACAO_ITENS =============
DROP POLICY IF EXISTS "Allow all on solicitacao_itens" ON public.solicitacao_itens;

CREATE POLICY "Authenticated can read solicitacao_itens"
ON public.solicitacao_itens FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Privileged can insert solicitacao_itens"
ON public.solicitacao_itens FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'projetista')
  OR public.has_role(auth.uid(), 'coordenador_campo')
  OR public.has_role(auth.uid(), 'comprador')
);

CREATE POLICY "Privileged can update solicitacao_itens"
ON public.solicitacao_itens FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'projetista')
  OR public.has_role(auth.uid(), 'coordenador_campo')
  OR public.has_role(auth.uid(), 'comprador')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'projetista')
  OR public.has_role(auth.uid(), 'coordenador_campo')
  OR public.has_role(auth.uid(), 'comprador')
);

CREATE POLICY "Privileged can delete solicitacao_itens"
ON public.solicitacao_itens FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'projetista')
  OR public.has_role(auth.uid(), 'coordenador_campo')
);

-- ============= INVENTARIO =============
DROP POLICY IF EXISTS "Allow all on inventario" ON public.inventario;

CREATE POLICY "Authenticated can read inventario"
ON public.inventario FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Privileged can insert inventario"
ON public.inventario FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
);

CREATE POLICY "Privileged can update inventario"
ON public.inventario FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
);

CREATE POLICY "Privileged can delete inventario"
ON public.inventario FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
);

-- ============= STORAGE: 'temp' bucket private + policies =============
UPDATE storage.buckets SET public = false WHERE id = 'temp';

CREATE POLICY "Authenticated can read temp"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'temp');

CREATE POLICY "Authenticated can upload temp"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'temp');

CREATE POLICY "Authenticated can update temp"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'temp');

CREATE POLICY "Authenticated can delete temp"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'temp');

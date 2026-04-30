-- Indexes to support server-side pagination, sorting and filtering on the
-- Solicitações list view. The page now queries with .range(), .order() and
-- ilike-based search; these indexes keep that fast as the table grows.

CREATE INDEX IF NOT EXISTS idx_solicitacoes_status
  ON public.solicitacoes (status);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_data_solicitacao
  ON public.solicitacoes (data_solicitacao DESC);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_created_at
  ON public.solicitacoes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_numero
  ON public.solicitacoes (numero);

CREATE INDEX IF NOT EXISTS idx_projects_descricao
  ON public.projects (descricao);

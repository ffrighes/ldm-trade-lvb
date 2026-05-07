-- Speed up `ilike '%term%'` searches used by useSolicitacoesPaginated /
-- useSolicitacoesKpis. B-tree indexes can't serve leading-wildcard ilike;
-- pg_trgm + GIN can.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_solicitacoes_numero_trgm
  ON public.solicitacoes USING GIN (numero gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_motivo_trgm
  ON public.solicitacoes USING GIN (motivo gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_erp_trgm
  ON public.solicitacoes USING GIN (erp gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_projects_numero_trgm
  ON public.projects USING GIN (numero gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_projects_descricao_trgm
  ON public.projects USING GIN (descricao gin_trgm_ops);

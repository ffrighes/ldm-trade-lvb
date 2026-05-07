-- Remove the `motivo` column from `solicitacoes` (BOMs no longer track motivo)
-- and drop the `inventario` table along with related indexes/triggers.

-- ---------- Update KPI RPC to drop motivo from search ----------
CREATE OR REPLACE FUNCTION public.get_solicitacoes_kpis(
  p_search text DEFAULT NULL,
  p_status text[] DEFAULT NULL,
  p_projeto uuid DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_project_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  total_solicitacoes bigint,
  total_abertas bigint,
  valor_abertas numeric,
  valor_total numeric,
  itens_pendentes bigint,
  ticket_medio numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      s.id,
      s.status,
      s.data_solicitacao,
      COALESCE(SUM(i.custo_total), 0) AS custo,
      COUNT(i.id) AS num_itens
    FROM public.solicitacoes s
    LEFT JOIN public.solicitacao_itens i ON i.solicitacao_id = s.id
    WHERE
      (p_status IS NULL OR array_length(p_status, 1) IS NULL OR s.status = ANY (p_status))
      AND (p_projeto IS NULL OR s.projeto_id = p_projeto)
      AND (p_from IS NULL OR s.data_solicitacao >= p_from)
      AND (p_to IS NULL OR s.data_solicitacao <= p_to)
      AND (
        p_search IS NULL OR p_search = '' OR
        s.numero ILIKE '%' || p_search || '%' OR
        s.erp ILIKE '%' || p_search || '%' OR
        (p_project_ids IS NOT NULL AND s.projeto_id = ANY (p_project_ids))
      )
    GROUP BY s.id, s.status, s.data_solicitacao
  ),
  abertas AS (
    SELECT * FROM filtered WHERE status NOT IN ('Finalizada', 'Cancelada')
  )
  SELECT
    (SELECT COUNT(*) FROM filtered) AS total_solicitacoes,
    (SELECT COUNT(*) FROM abertas) AS total_abertas,
    (SELECT COALESCE(SUM(custo), 0) FROM abertas) AS valor_abertas,
    (SELECT COALESCE(SUM(custo), 0) FROM filtered) AS valor_total,
    (SELECT COALESCE(SUM(num_itens), 0) FROM abertas) AS itens_pendentes,
    (
      SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE COALESCE(AVG(custo), 0) END
      FROM filtered
    ) AS ticket_medio;
$$;

-- ---------- Drop motivo column ----------
DROP INDEX IF EXISTS public.idx_solicitacoes_motivo_trgm;
ALTER TABLE public.solicitacoes DROP COLUMN IF EXISTS motivo;

-- ---------- Drop inventario table ----------
DROP TABLE IF EXISTS public.inventario CASCADE;

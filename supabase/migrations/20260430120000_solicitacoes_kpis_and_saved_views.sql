-- Phase 2: KPI aggregations and per-user saved filter views.
--
-- 1. RPC `get_solicitacoes_kpis` returns aggregated metrics matching the
--    same filters as the list query, without transferring rows to the
--    client. The list page uses this for the cards above the table.
-- 2. Table `solicitacao_saved_views` stores user-defined filter presets
--    keyed by auth.uid(), with the first non-permissive RLS policies in
--    this project.

-- ---------- KPI RPC ----------

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
        s.motivo ILIKE '%' || p_search || '%' OR
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

-- ---------- Saved views ----------

CREATE TABLE IF NOT EXISTS public.solicitacao_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_solicitacao_saved_views_user
  ON public.solicitacao_saved_views (user_id);

ALTER TABLE public.solicitacao_saved_views ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own saved views. These are intentionally
-- the first non-permissive RLS policies in the project; do not loosen.
DROP POLICY IF EXISTS "saved_views_select_own" ON public.solicitacao_saved_views;
CREATE POLICY "saved_views_select_own"
  ON public.solicitacao_saved_views
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_views_insert_own" ON public.solicitacao_saved_views;
CREATE POLICY "saved_views_insert_own"
  ON public.solicitacao_saved_views
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_views_update_own" ON public.solicitacao_saved_views;
CREATE POLICY "saved_views_update_own"
  ON public.solicitacao_saved_views
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_views_delete_own" ON public.solicitacao_saved_views;
CREATE POLICY "saved_views_delete_own"
  ON public.solicitacao_saved_views
  FOR DELETE
  USING (user_id = auth.uid());

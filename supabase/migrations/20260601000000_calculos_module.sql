-- Módulo de Cálculos de Engenharia — Fundação
--
-- Tabela `calculos`: documenta memórias de cálculo por projeto,
-- baseadas em templates tipados definidos em src/lib/calculoTemplates.ts.
-- Os campos tipo, valores, formula e resultado_unidade são snapshots
-- gravados no momento do registro; editar o template depois NÃO altera
-- registros existentes.

-- ── 1. Função auxiliar set_updated_at (idempotente) ─────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── 2. Tabela calculos ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.calculos (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id       uuid         NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  template_id      text         NOT NULL,
  titulo           text         NOT NULL,
  tipo             text         NOT NULL DEFAULT '',
  valores          jsonb        NOT NULL DEFAULT '[]'::jsonb,
  formula          text         NOT NULL DEFAULT '',
  resultado_valor  numeric,
  resultado_unidade text        NOT NULL DEFAULT '',
  premissas        text         NOT NULL DEFAULT '',
  referencias      text         NOT NULL DEFAULT '',
  revisao          text         NOT NULL DEFAULT '0',
  status           text         NOT NULL DEFAULT 'Rascunho'
                                CHECK (status IN ('Rascunho', 'Em Revisão', 'Aprovado')),
  autor_id         uuid         DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calculos_projeto_id_idx ON public.calculos (projeto_id);

-- ── 3. Trigger updated_at ────────────────────────────────────────────────────

CREATE TRIGGER set_calculos_updated_at
  BEFORE UPDATE ON public.calculos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ── 4. RLS — espelha exatamente as políticas de `projects` ──────────────────

ALTER TABLE public.calculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read calculos"
  ON public.calculos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Privileged can insert calculos"
  ON public.calculos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'projetista')
  );

CREATE POLICY "Privileged can update calculos"
  ON public.calculos
  FOR UPDATE
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

CREATE POLICY "Admin/Gerente can delete calculos"
  ON public.calculos
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
  );

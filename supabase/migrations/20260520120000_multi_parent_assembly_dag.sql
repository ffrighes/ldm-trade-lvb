-- =====================================================================
-- Multi-parent assembly DAG (Bill of Materials — grafo acíclico dirigido)
-- Tabelas: assemblies (nós) + assembly_edges (arestas com quantity)
-- Funções: cycle detection trigger, RPC transacional, BOM explosion
-- =====================================================================

-- ─── Tabela de nós ───────────────────────────────────────────────────
CREATE TABLE assemblies (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  unit_weight numeric,                          -- kg, nullable
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Tabela de arestas (relação pai→filho com quantidade) ─────────────
CREATE TABLE assembly_edges (
  parent_id  uuid    NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
  child_id   uuid    NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
  quantity   numeric NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, child_id),           -- sem duplicata exata
  CHECK (parent_id <> child_id)                -- sem auto-laço trivial
);

CREATE INDEX idx_assembly_edges_child  ON assembly_edges(child_id);
CREATE INDEX idx_assembly_edges_parent ON assembly_edges(parent_id);

-- ─── updated_at automático ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION assemblies_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assemblies_updated_at
  BEFORE UPDATE ON assemblies
  FOR EACH ROW EXECUTE FUNCTION assemblies_set_updated_at();

-- ─── Detecção de ciclo (trigger BEFORE INSERT OR UPDATE) ─────────────
-- Invariante 3: rejeita aresta se ela fecharia um ciclo.
-- A lógica: verifica, via CTE recursivo, se NEW.parent_id já é
-- alcançável a partir de NEW.child_id. Se for, RAISE EXCEPTION.
CREATE OR REPLACE FUNCTION assembly_edges_check_cycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Auto-laço já capturado pelo CHECK, mas bloqueamos explicitamente
  -- para mensagem mais clara.
  IF NEW.parent_id = NEW.child_id THEN
    RAISE EXCEPTION 'ciclo detectado: um conjunto não pode ser filho de si mesmo (id: %)', NEW.parent_id;
  END IF;

  -- Verifica se NEW.parent_id já é descendente de NEW.child_id.
  -- Se for, inserir (parent, child) fecharia um ciclo.
  IF EXISTS (
    WITH RECURSIVE descendants AS (
      SELECT child_id AS node_id
      FROM   assembly_edges
      WHERE  parent_id = NEW.child_id
      UNION ALL
      SELECT e.child_id
      FROM   assembly_edges e
      JOIN   descendants d ON e.parent_id = d.node_id
    )
    SELECT 1 FROM descendants WHERE node_id = NEW.parent_id
  ) THEN
    RAISE EXCEPTION
      'ciclo detectado: % já é ancestral de % — a aresta foi rejeitada',
      NEW.child_id, NEW.parent_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assembly_edges_check_cycle
  BEFORE INSERT OR UPDATE ON assembly_edges
  FOR EACH ROW EXECUTE FUNCTION assembly_edges_check_cycle();

-- ─── Função auxiliar para pré-validação no cliente ────────────────────
-- Retorna true se adicionar a aresta (p_parent_id → p_child_id) criaria ciclo.
CREATE OR REPLACE FUNCTION assembly_would_cycle(p_parent_id uuid, p_child_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p_parent_id = p_child_id
    OR EXISTS (
      WITH RECURSIVE descendants AS (
        SELECT child_id AS node_id
        FROM   assembly_edges
        WHERE  parent_id = p_child_id
        UNION ALL
        SELECT e.child_id
        FROM   assembly_edges e
        JOIN   descendants d ON e.parent_id = d.node_id
      )
      SELECT 1 FROM descendants WHERE node_id = p_parent_id
    );
$$;

-- ─── RPC transacional: insere em múltiplos pais de uma vez ────────────
-- Invariante 4 da especificação: se qualquer aresta gerar ciclo,
-- TODA a transação faz rollback (Postgres garante isso via RAISE EXCEPTION
-- dentro da função com BEGIN/END).
CREATE OR REPLACE FUNCTION add_assembly_to_parents(
  p_child_id uuid,
  p_parents  jsonb   -- [{parent_id: uuid, quantity: numeric}, ...]
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  item      jsonb;
  v_pid     uuid;
  v_qty     numeric;
  inserted  int := 0;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_parents) LOOP
    v_pid := (item->>'parent_id')::uuid;
    v_qty := (item->>'quantity')::numeric;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION
        'quantidade inválida para o pai %: deve ser > 0 (recebido: %)',
        v_pid, item->>'quantity';
    END IF;

    -- O trigger trg_assembly_edges_check_cycle dispara aqui.
    -- Se detectar ciclo, RAISE EXCEPTION → rollback automático de tudo.
    INSERT INTO assembly_edges (parent_id, child_id, quantity)
    VALUES (v_pid, p_child_id, v_qty);

    inserted := inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'inserted', inserted);
END;
$$;

-- ─── Explosão de BOM (invariante 5) ─────────────────────────────────
-- effective_quantity = Σ ( Π quantity_e por cada caminho raiz→descendente ).
-- Exemplo verificável: A→2×B→3×D e A→1×C→5×D ⟹ D.effective_quantity = 11.
-- is_multi_path = true quando o nó é alcançado por mais de um caminho (diamante).
CREATE OR REPLACE FUNCTION explode_bom(p_root_id uuid)
RETURNS TABLE(
  descendant_id      uuid,
  level              integer,
  effective_quantity numeric,
  is_multi_path      boolean
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH RECURSIVE bom_traverse AS (
    -- Base: filhos diretos do nó raiz
    SELECT
      e.child_id                 AS descendant_id,
      1                          AS level,
      e.quantity                 AS path_quantity,
      ARRAY[e.child_id]::uuid[]  AS visited
    FROM assembly_edges e
    WHERE e.parent_id = p_root_id

    UNION ALL

    -- Recursão: desce mais um nível multiplicando a quantidade
    SELECT
      e.child_id,
      bt.level + 1,
      bt.path_quantity * e.quantity,
      bt.visited || e.child_id
    FROM assembly_edges e
    JOIN bom_traverse bt ON e.parent_id = bt.descendant_id
    -- Defesa em profundidade contra ciclos residuais (não deve ocorrer com
    -- o trigger ativo, mas evita loop infinito como salvaguarda)
    WHERE NOT (e.child_id = ANY(bt.visited))
  )
  SELECT
    t.descendant_id,
    MIN(t.level)::integer   AS level,
    SUM(t.path_quantity)    AS effective_quantity,
    (COUNT(*) > 1)          AS is_multi_path
  FROM bom_traverse t
  GROUP BY t.descendant_id
  ORDER BY MIN(t.level), t.descendant_id;
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE assemblies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assemblies_select"
  ON assemblies FOR SELECT TO authenticated USING (true);

CREATE POLICY "assemblies_insert"
  ON assemblies FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "assemblies_update"
  ON assemblies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "assemblies_delete"
  ON assemblies FOR DELETE TO authenticated USING (true);

CREATE POLICY "assembly_edges_select"
  ON assembly_edges FOR SELECT TO authenticated USING (true);

CREATE POLICY "assembly_edges_insert"
  ON assembly_edges FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "assembly_edges_update"
  ON assembly_edges FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "assembly_edges_delete"
  ON assembly_edges FOR DELETE TO authenticated USING (true);

-- ─── Permissões de execução ──────────────────────────────────────────
GRANT EXECUTE ON FUNCTION add_assembly_to_parents   TO authenticated;
GRANT EXECUTE ON FUNCTION explode_bom               TO authenticated;
GRANT EXECUTE ON FUNCTION assembly_would_cycle      TO authenticated;

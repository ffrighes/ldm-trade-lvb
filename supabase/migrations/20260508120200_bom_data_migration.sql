-- Hierarchical BOM (Phase 3: data migration).
--
-- Backfills the new BOM tables from the existing flat `solicitacoes` /
-- `solicitacao_itens` data so historic purchase requests are also visible
-- as a (legacy) Conjunto with a single RELEASED version.
--
-- The original `solicitacoes` entity is kept untouched as the
-- "purchase request" workflow (status flow Aberta/Aprovada/...).

DO $$
DECLARE
  s          record;
  it         record;
  v_root     uuid;
  v_version  uuid;
  v_root_n   uuid;
  v_codigo   text;
  v_name     text;
  v_position int;
BEGIN
  FOR s IN
    SELECT * FROM public.solicitacoes ORDER BY data_solicitacao, created_at
  LOOP
    -- Skip if already migrated (idempotency by codigo within the project).
    v_codigo := 'LEGACY-' || s.numero;
    PERFORM 1 FROM public.bom_root
      WHERE project_id = s.projeto_id AND codigo = v_codigo;
    IF FOUND THEN CONTINUE; END IF;

    v_name := COALESCE(NULLIF(trim(s.notas), ''), s.numero);

    INSERT INTO public.bom_root (project_id, codigo, name, created_at)
      VALUES (s.projeto_id, v_codigo, v_name, s.created_at)
      RETURNING id INTO v_root;

    INSERT INTO public.bom_version
      (root_id, version_number, label, status, notes, created_at)
    VALUES
      (v_root, 1,
       NULLIF(trim(s.revisao), ''),
       'DRAFT',  -- temporarily DRAFT so we can insert nodes; promoted below
       'Migrado de ' || s.numero,
       s.created_at)
    RETURNING id INTO v_version;

    INSERT INTO public.bom_node
      (version_id, parent_id, node_type, name, position, created_at)
    VALUES
      (v_version, NULL, 'CONJUNTO', v_name, 0, s.created_at)
    RETURNING id INTO v_root_n;

    v_position := 0;
    FOR it IN
      SELECT * FROM public.solicitacao_itens
       WHERE solicitacao_id = s.id
       ORDER BY id
    LOOP
      IF it.material_id IS NOT NULL THEN
        INSERT INTO public.bom_node
          (version_id, parent_id, node_type, material_id, quantity, position, notes, created_at)
        VALUES
          (v_version, v_root_n, 'ITEM', it.material_id, GREATEST(it.quantidade, 0.000001),
           v_position, NULLIF(trim(COALESCE(it.notas, '')), ''), s.created_at);
      ELSE
        -- "Special" item without material_id: model it as SUBCONJUNTO (a
        -- placeholder in the tree). Quantity preserved.
        INSERT INTO public.bom_node
          (version_id, parent_id, node_type, name, quantity, position, notes, created_at)
        VALUES
          (v_version, v_root_n, 'SUBCONJUNTO',
           COALESCE(NULLIF(trim(it.descricao), ''), 'Item especial'),
           GREATEST(it.quantidade, 0.000001),
           v_position, NULLIF(trim(COALESCE(it.notas, '')), ''), s.created_at);
      END IF;
      v_position := v_position + 1;
    END LOOP;

    -- Promote to RELEASED. The status guard trigger will demote any other
    -- RELEASED for this root (none, since we just created it).
    UPDATE public.bom_version SET status = 'RELEASED' WHERE id = v_version;
  END LOOP;
END $$;

-- Port existing solicitacao_comments and solicitacao_drawings to the
-- corresponding migrated bom_version. Keep the originals untouched.
DO $$
DECLARE
  c         record;
  d         record;
  v_version uuid;
BEGIN
  FOR c IN SELECT * FROM public.solicitacao_comments LOOP
    SELECT v.id INTO v_version
      FROM public.bom_version v
      JOIN public.bom_root    r ON r.id = v.root_id
     WHERE r.codigo = 'LEGACY-' || (
              SELECT numero FROM public.solicitacoes WHERE id = c.solicitacao_id
            )
     LIMIT 1;
    IF v_version IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.bom_comments
      (version_id, author_id, author_email, body, created_at)
    VALUES
      (v_version, c.author_id, c.author_email, c.body, c.created_at)
    ON CONFLICT DO NOTHING;
  END LOOP;

  FOR d IN
    SELECT sd.*, s.numero AS sol_numero
      FROM public.solicitacao_drawings sd
      JOIN public.solicitacoes s ON s.id = sd.solicitacao_id
  LOOP
    SELECT v.id INTO v_version
      FROM public.bom_version v
      JOIN public.bom_root r ON r.id = v.root_id
     WHERE r.codigo = 'LEGACY-' || d.sol_numero
     LIMIT 1;
    IF v_version IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.bom_drawings
      (version_id, revision, url, uploaded_by, uploaded_at, notes)
    VALUES
      (v_version,
       COALESCE(NULLIF(trim(d.revisao), ''), '1'),
       d.url, d.uploaded_by, d.uploaded_at, d.notas)
    ON CONFLICT (version_id, revision) DO NOTHING;
  END LOOP;
EXCEPTION WHEN undefined_table OR undefined_column THEN
  -- If the legacy comments/drawings schema differs from what we expect, skip
  -- the port silently — the operator can re-run a tailored backfill later.
  NULL;
END $$;

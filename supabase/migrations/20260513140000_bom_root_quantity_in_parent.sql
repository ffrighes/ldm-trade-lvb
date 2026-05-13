-- Add an explicit quantity for the parent → child relationship between
-- bom_root entries. This is the number of child sub-conjuntos used inside
-- a single unit of the parent root. The value only makes sense when
-- parent_id IS NOT NULL; for top-level roots we always keep it at 1 to
-- avoid NULL handling in clients.

ALTER TABLE public.bom_root
  ADD COLUMN IF NOT EXISTS quantity_in_parent numeric NOT NULL DEFAULT 1
    CHECK (quantity_in_parent > 0);

COMMENT ON COLUMN public.bom_root.quantity_in_parent IS
  'Quantidade do Conjunto-filho dentro de uma unidade do Conjunto-pai. '
  'Só faz sentido quando parent_id IS NOT NULL; raízes sempre 1.';

-- ── Updated RPC: set parent (now also accepts a quantity) ──────────────
-- Drop the old signature so the new default-parameter form replaces it cleanly.
DROP FUNCTION IF EXISTS public.bom_root_set_parent(uuid, uuid);

CREATE OR REPLACE FUNCTION public.bom_root_set_parent(
  p_root_id   uuid,
  p_parent_id uuid,
  p_quantity  numeric DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_root_project   uuid;
  v_parent_project uuid;
BEGIN
  SELECT project_id INTO v_root_project FROM public.bom_root WHERE id = p_root_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conjunto % não encontrado.', p_root_id;
  END IF;

  IF p_parent_id IS NOT NULL THEN
    SELECT project_id INTO v_parent_project FROM public.bom_root WHERE id = p_parent_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conjunto pai % não encontrado.', p_parent_id;
    END IF;
    IF v_root_project <> v_parent_project THEN
      RAISE EXCEPTION 'O Conjunto pai deve pertencer ao mesmo projeto.';
    END IF;
    IF p_parent_id = p_root_id THEN
      RAISE EXCEPTION 'Um Conjunto não pode ser seu próprio pai.';
    END IF;
    IF public.bom_root_would_cycle(p_root_id, p_parent_id) THEN
      RAISE EXCEPTION 'Operação criaria uma referência circular entre Conjuntos.';
    END IF;

    IF p_quantity IS NOT NULL AND p_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade no pai deve ser maior que zero.';
    END IF;

    UPDATE public.bom_root
       SET parent_id = p_parent_id,
           quantity_in_parent = COALESCE(p_quantity, quantity_in_parent)
     WHERE id = p_root_id;
  ELSE
    -- Detaching from parent: always reset quantity_in_parent to 1.
    UPDATE public.bom_root
       SET parent_id = NULL,
           quantity_in_parent = 1
     WHERE id = p_root_id;
  END IF;
END;
$$;

-- ── New RPC: set quantity_in_parent only ───────────────────────────────
CREATE OR REPLACE FUNCTION public.bom_root_set_quantity_in_parent(
  p_root_id  uuid,
  p_quantity numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_parent uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade no pai deve ser maior que zero.';
  END IF;

  SELECT parent_id INTO v_parent FROM public.bom_root WHERE id = p_root_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conjunto % não encontrado.', p_root_id;
  END IF;
  IF v_parent IS NULL THEN
    RAISE EXCEPTION 'Conjunto sem pai não tem quantidade no pai.';
  END IF;

  UPDATE public.bom_root
     SET quantity_in_parent = p_quantity
   WHERE id = p_root_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bom_root_set_parent(uuid, uuid, numeric)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.bom_root_set_quantity_in_parent(uuid, numeric)      TO authenticated;

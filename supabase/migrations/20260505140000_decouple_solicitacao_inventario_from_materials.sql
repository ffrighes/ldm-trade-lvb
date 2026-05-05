-- Decouple solicitacao_itens and inventario from the master materials table.
-- Goal: items are immutable snapshots after insertion. Editing or deleting a
-- material in the master DB must not propagate to existing items.
--
-- Changes:
--   1. Replace material_id FK with ON DELETE SET NULL so master deletions
--      don't fail and don't mutate the snapshot text fields.
--   2. Add `erp` snapshot column to solicitacao_itens and inventario so the
--      ERP code displayed for an item is captured at insertion time instead
--      of being looked up at render time.
--   3. Backfill `erp` from materials for existing rows (one-time only —
--      idempotent: NULL → current value; never overwrites once set).
--   4. Update transfer_items_to_inventario() to copy the new column.
--
-- Reversibility: drop the new columns and restore the original FK with
-- `ON DELETE NO ACTION`. The snapshot data already lives in the existing
-- denormalized columns, so no data is lost on rollback.

-- 1. Re-create FKs with ON DELETE SET NULL ------------------------------------
ALTER TABLE public.solicitacao_itens
  DROP CONSTRAINT IF EXISTS solicitacao_itens_material_id_fkey;
ALTER TABLE public.solicitacao_itens
  ADD CONSTRAINT solicitacao_itens_material_id_fkey
  FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE SET NULL;

ALTER TABLE public.inventario
  DROP CONSTRAINT IF EXISTS inventario_material_id_fkey;
ALTER TABLE public.inventario
  ADD CONSTRAINT inventario_material_id_fkey
  FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.solicitacao_itens.material_id IS
  'Historical traceability only. Do NOT use for functional lookups: descricao, bitola, unidade, custo_unitario and erp are snapshots taken at insertion time.';
COMMENT ON COLUMN public.inventario.material_id IS
  'Historical traceability only. Do NOT use for functional lookups: descricao, bitola, unidade, custo_unitario and erp are snapshots taken at insertion time.';

-- 2. Add erp snapshot column --------------------------------------------------
ALTER TABLE public.solicitacao_itens
  ADD COLUMN IF NOT EXISTS erp TEXT NOT NULL DEFAULT '';
ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS erp TEXT NOT NULL DEFAULT '';

-- 3. Backfill erp for existing rows (only when blank) -------------------------
UPDATE public.solicitacao_itens si
SET erp = COALESCE(m.erp, '')
FROM public.materials m
WHERE si.material_id = m.id
  AND (si.erp IS NULL OR si.erp = '')
  AND m.erp IS NOT NULL;

UPDATE public.inventario inv
SET erp = COALESCE(m.erp, '')
FROM public.materials m
WHERE inv.material_id = m.id
  AND (inv.erp IS NULL OR inv.erp = '')
  AND m.erp IS NOT NULL;

-- 4. Update inventory transfer trigger to carry erp forward -------------------
CREATE OR REPLACE FUNCTION public.transfer_items_to_inventario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'Finalizada' AND OLD.status IS DISTINCT FROM 'Finalizada' THEN
    INSERT INTO public.inventario
      (projeto_id, solicitacao_id, material_id, descricao, bitola, unidade, quantidade, custo_unitario, custo_total, erp)
    SELECT NEW.projeto_id, NEW.id, si.material_id, si.descricao, si.bitola, si.unidade, si.quantidade, si.custo_unitario, si.custo_total, si.erp
    FROM public.solicitacao_itens si
    WHERE si.solicitacao_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

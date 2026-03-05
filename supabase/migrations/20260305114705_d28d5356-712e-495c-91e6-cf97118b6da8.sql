
-- Add new columns to materials table
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS sch text NOT NULL DEFAULT '';
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS erp text NOT NULL DEFAULT '';
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS notas text NOT NULL DEFAULT '';

-- Clear FK references first
UPDATE public.solicitacao_itens SET material_id = NULL WHERE material_id IS NOT NULL;

-- Delete all existing materials data
DELETE FROM public.materials;

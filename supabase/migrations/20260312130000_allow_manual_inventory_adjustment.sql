
-- Allow manual stock adjustments: make solicitacao_id nullable and add tipo column
ALTER TABLE public.inventario
  ALTER COLUMN solicitacao_id DROP NOT NULL;

ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'solicitacao';

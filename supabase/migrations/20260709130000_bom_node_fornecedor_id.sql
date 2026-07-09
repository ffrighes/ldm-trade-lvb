-- Vincula um item da LDM (bom_node) ao seu fornecedor.
-- A tabela public.fornecedores já existe (ver 20260518120000_fornecedores_e_precos.sql).
-- Seguimos a mesma convenção usada em materials.fornecedor_id
-- (20260709120000_materials_fornecedor_id.sql): referência por id, nullable,
-- com ON DELETE SET NULL para nunca apagar itens da LDM ao excluir um fornecedor.
-- Vínculo sempre por FK — nunca texto livre.
ALTER TABLE public.bom_node
  ADD COLUMN IF NOT EXISTS fornecedor_id UUID NULL
  REFERENCES public.fornecedores(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bom_node_fornecedor ON public.bom_node(fornecedor_id);

-- Sem novas policies: bom_node já tem RLS habilitada; adicionar uma coluna
-- nullable não altera o modelo de permissão existente.

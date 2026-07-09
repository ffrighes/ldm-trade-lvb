-- Vincula um material ao seu fornecedor preferencial.
-- A tabela public.fornecedores já existe (ver 20260518120000_fornecedores_e_precos.sql)
-- como cadastro mestre com PK uuid. Seguimos a convenção de FK do restante do
-- schema (fornecedor_precos.fornecedor_id, orcamentos.fornecedor_id): referência
-- por id, nullable, com ON DELETE SET NULL para evitar materiais órfãos.
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS fornecedor_id UUID NULL
  REFERENCES public.fornecedores(id)
  ON UPDATE CASCADE
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_materials_fornecedor ON public.materials(fornecedor_id);

-- Sem novas policies: materials já tem RLS habilitada; adicionar uma coluna
-- nullable não altera o modelo de permissão existente. A tabela fornecedores
-- mantém suas próprias policies has_role(admin|gerente|comprador).

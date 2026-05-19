## Diagnóstico

A página de BOMs (`src/pages/BomTreePage.tsx`) já oferece:
- **Novo Conjunto** (`CreateConjuntoDialog`) — cria conjunto vazio, opcionalmente filho de outro.
- **Clonar de outro projeto** (`CloneFromProjectDialog`) — duplica um conjunto de outro projeto via RPC `bom_clone_root`.

Não existe ainda a ação de duplicar um conjunto do **próprio projeto** para dentro de outro conjunto do mesmo projeto. O backend já tem tudo o que é preciso:
- `bom_clone_root(p_source_version_id, p_target_project_id, p_codigo, p_name, p_label, p_notes)` — cria um novo `bom_root` (DRAFT v1) copiando a árvore de nós de qualquer versão de origem.
- `bom_root_set_parent(p_root_id, p_parent_id, p_quantity)` — pendura o novo root como filho do destino, com `quantity_in_parent`.

O hook `useCloneBomRoot` já encapsula a chamada ao RPC e invalida `bom-roots`.

## Arquivos afetados

- **Novo:** `src/components/bom/CopyConjuntoDialog.tsx` — diálogo da feature.
- **Editado:** `src/pages/BomTreePage.tsx` — botão "Copiar Conjunto" no header + estado do diálogo.

## Sequência de operações

1. Criar `CopyConjuntoDialog.tsx`:
   - Props: `open`, `onOpenChange`, `projectId`, `defaultSourceRootId?`, `onCopied?(rootId, versionId)`.
   - Campos:
     - **Conjunto de origem** (`Select`) — alimentado por `useBomRoots(projectId)`.
     - **Versão de origem** (`Select`) — `useBomVersions(sourceRootId)`; default = RELEASED ou a mais recente; rótulo `v{n} — {label} ({status})`.
     - **Conjunto destino (pai)** (`Select`) — lista os roots do projeto **exceto** o próprio origem e seus descendentes (usar `buildRootTree`/`getDescendantIds` para filtrar e evitar ciclo). Exibe indentação por `depth`.
     - **Quantidade no pai** (`Input number`, default 1, > 0).
     - **Novo código** (`Input`, obrigatório, pré-preenchido com `"{codigoOrigem}-COPY"`).
     - **Novo nome** (`Input`, obrigatório, pré-preenchido com `"{nomeOrigem} (cópia)"`).
     - **Rótulo v1** (opcional), **Notas** (opcional).
   - Submissão:
     1. `useCloneBomRoot.mutateAsync({ sourceVersionId, targetProjectId: projectId, codigo, name, label, notes })`.
     2. `useSetBomRootParent.mutateAsync({ rootId: novo, projectId, parentId: destino })`.
     3. Se `quantity ≠ 1`: `useSetBomRootQuantityInParent.mutateAsync({ rootId: novo, projectId, quantity })`.
     4. `toast.success`, fechar, chamar `onCopied(root_id, version_id)` para selecionar o novo conjunto.
   - Validação de erro: try/catch com `toast.error`.

2. Editar `BomTreePage.tsx`:
   - Importar `CopyConjuntoDialog`.
   - Adicionar estado `openCopy`.
   - Adicionar botão "Copiar Conjunto" (ícone `Copy` ou `CopyPlus`) no header ao lado de "Novo Conjunto", visível quando `canCloneBom`/`canEditBomDraft` (mesma regra do clone).
   - Pré-selecionar `defaultSourceRootId = selectedRootId` para conveniência.
   - `onCopied` → `setSelection(rootId, versionId)`.

## Dependências e ordem

- A criação do dialog (1) é independente.
- A integração na página (2) depende do dialog existir.
- Não há mudança de schema nem de RPC.

## Riscos

- **Ciclo de hierarquia** → filtrar destinos pelos descendentes via `getDescendantIds`; o trigger `bom_root_check_cycle` é a defesa final.
- **Permissões** → RPCs já checam `bom_assert_editor`; gatear UI por `usePermissions.canCloneBom && canEditBomDraft`.
- **Falha parcial** (clone OK, set_parent falha) → tratar erro: avisar usuário; o conjunto novo permanecerá como raiz e poderá ser ajustado manualmente.
- **Código duplicado** — `bom_root.codigo` não tem unique constraint no schema, mas convém validar em UI; manteremos validação simples (não vazio) e dependeremos do banco se houver constraint futura.

## Critérios de sucesso

- [ ] Botão "Copiar Conjunto" aparece no header da página de BOMs para usuários com permissão.
- [ ] Diálogo lista apenas conjuntos do projeto atual; destinos excluem o próprio origem e descendentes.
- [ ] Após confirmar, novo conjunto DRAFT é criado como filho do destino com a quantidade informada.
- [ ] A árvore de nós (SUBCONJUNTO/ITEM) é copiada integralmente da versão escolhida.
- [ ] A página seleciona automaticamente o conjunto recém-criado.
- [ ] Erros são exibidos via toast e nada parcial fica em estado inconsistente do ponto de vista do usuário.

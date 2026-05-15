# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run lint         # ESLint
npm run test         # run all tests (Vitest)
npm run test:watch   # watch mode
npx vitest run src/path/to/file.test.ts  # single test file
```

## Architecture Overview

This is a React 18 + TypeScript SPA built with Vite, using Supabase as the backend and deployed via Lovable.dev.

### Tech Stack

- **UI**: shadcn/ui (Radix UI primitives) + Tailwind CSS
- **Routing**: React Router v6
- **Server state**: TanStack React Query — all Supabase data fetching goes through `useQuery`/`useMutation`
- **Auth**: Supabase Auth, wrapped in `AuthProvider` (`src/hooks/useAuth.tsx`)
- **Roles & permissions**: `useUserRole` fetches the role via `get_user_role` RPC; `usePermissions` (`src/hooks/usePermissions.ts`) derives all capability flags from it
- **Legacy local store**: Zustand store in `src/store/useAppStore.ts` persisted to `localStorage` — this was used before Supabase integration and is now largely superseded

### Directory Layout

```
src/
  pages/          # Route-level components (one per route)
  components/
    ui/           # shadcn/ui auto-generated primitives — do not hand-edit
    solicitacoes/ # Feature components scoped to the solicitações list/form
    AppLayout.tsx / NavLink.tsx / ProtectedRoute.tsx
  hooks/
    useAuth.tsx              # Auth context + helpers
    usePermissions.ts        # Role-based permission flags
    useUserRole.ts           # Queries user role from Supabase RPC
    useSupabaseData.ts       # All CRUD hooks (materials, projects, solicitações, etc.)
    useSolicitacoesFilters.ts# URL-param-based filter/sort/pagination state
    useSolicitacaoRealtime.ts# Supabase realtime subscription for status changes & comments
    useSolicitacaoActivity.ts# Audit trail + comments + drawings queries/mutations
    useInventario.ts         # Inventory queries
  integrations/supabase/
    client.ts     # Supabase client (has hardcoded fallback URL/key for prod safety)
    types.ts      # Auto-generated database types — regenerate via Supabase CLI
  types/index.ts  # App-level TypeScript interfaces
  store/          # Legacy Zustand store (do not add new features here)
  lib/            # Pure utilities (formatCurrency, exportSolicitacoes, etc.)
supabase/
  migrations/     # Applied in timestamp order — add new SQL files here
  functions/      # Supabase Edge Functions (import-materials, manage-users)
```

### Routing & Auth

All routes except `/login`, `/redefinir-senha`, and `/atualizar-senha` are wrapped in `<ProtectedRoute>`, which redirects unauthenticated users to `/login`. The `AppLayout` renders the sidebar nav.

### Role-Based Access Control

Five roles defined as a Postgres enum (`app_role`): `admin`, `gerente`, `projetista`, `comprador`, `coordenador_campo`. Permissions are enforced both in the UI via `usePermissions` and at the database level via RLS policies. Never bypass `usePermissions` checks; they mirror the RLS rules.

### Solicitações Filter State

All filters, sort, and pagination state for the `/solicitacoes` list are stored in URL search params (not React state). This is managed by `useSolicitacoesFilters`. Adding new filters means extending that hook and the URL param parsing.

### Data Flow Pattern

1. Page imports hooks from `useSupabaseData.ts` (or feature-specific hooks)
2. Mutations call `supabase.from(...)` and `onSuccess` invalidates relevant query keys
3. Realtime updates arrive via `useSolicitacaoRealtime`, which also invalidates queries and shows toasts

### Database Migrations

Add new SQL files to `supabase/migrations/` with a timestamp prefix. Key tables: `projects`, `materials`, `solicitacoes`, `solicitacao_itens`, `inventario`, `solicitacao_audit` (append-only, written by trigger), `solicitacao_comments`, `solicitacao_drawings`. The audit trigger (`log_solicitacao_audit`) is `SECURITY DEFINER` and cannot be bypassed via the API.

### Environment Variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

The client has hardcoded fallback values for the production project so the app works even if env vars fail to inline at build time.

---

# CLAUDE.md — Workflow de Planejamento e Implementação

## Regra Fundamental de Modelos

**NUNCA execute implementações diretamente sem planejamento aprovado.**

| Etapa        | Modelo              | Propósito                            |
|--------------|---------------------|--------------------------------------|
| Planejamento | `claude-opus-4-7`   | Análise profunda, melhoria de prompt |
| Implementação| `claude-sonnet-4-6` | Execução rápida e eficiente          |

---

## PROTOCOLO OBRIGATÓRIO — Toda Solicitação de Alteração

Antes de qualquer implementação, YOU MUST executar as 3 etapas abaixo na ordem.

---

### ETAPA 1 — Melhoria do Prompt (Opus 4.7 · Plan Mode)

Ao receber uma solicitação de alteração:

1. **Reescreva o prompt** para torná-lo mais preciso, sem ambiguidades e acionável
2. **Identifique o que está implícito** mas não foi dito pelo usuário
3. **Aponte lacunas** de informação que bloqueiam a implementação
4. **Classifique a complexidade:** Simples / Média / Alta / Crítica

Formato de saída obrigatório:

```
## PROMPT MELHORADO
[versão reescrita e melhorada do pedido original]

## O QUE FOI ADICIONADO
- [item implícito identificado]
- [ambiguidade resolvida]

## DADOS INSUFICIENTES (se houver)
- [informação necessária que falta]

## COMPLEXIDADE
[Simples | Média | Alta | Crítica] — [justificativa em 1 linha]
```

---

### ETAPA 2 — Plano de Implementação (Opus 4.7 · Plan Mode)

Com o prompt melhorado, produza o plano antes de qualquer execução:

```
## DIAGNÓSTICO
[estado atual relevante do código/sistema]

## ARQUIVOS AFETADOS
- path/arquivo.ext — [o que muda e por quê]

## SEQUÊNCIA DE OPERAÇÕES
1. [operação] → [arquivo] → [resultado esperado]
2. ...

## DEPENDÊNCIAS E ORDEM
[o que deve ser feito antes do quê]

## RISCOS
- [risco] → [mitigação]

## CRITÉRIOS DE SUCESSO
- [ ] [verificação objetiva 1]
- [ ] [verificação objetiva 2]

## SKILLS A CONSULTAR
- [path/SKILL.md se aplicável]
```

**NÃO EXECUTE nada nesta etapa. Aguarde aprovação explícita.**

---

### ETAPA 3 — Implementação (Sonnet 4.6)

Somente após aprovação do plano:

```bash
# Trocar para Sonnet antes de executar
claude --model claude-sonnet-4-6
```

- Seguir o plano aprovado sem desvios
- Reportar cada arquivo modificado ao concluir
- Se encontrar bloqueio inesperado: PARAR e reportar antes de improvisar

---

## Skills Obrigatórias por Contexto

Consulte SEMPRE antes de agir na área correspondente:

| Contexto                  | Skill a consultar                              |
|---------------------------|------------------------------------------------|
| Banco de dados / Backend  | `/mnt/skills/user/supabase/SKILL.md`           |
| Frontend / UI             | `/mnt/skills/user/frontend-design/SKILL.md`    |
| Documentos Word           | `/mnt/skills/public/docx/SKILL.md`             |
| Apresentações             | `/mnt/skills/public/pptx/SKILL.md`             |
| PDFs                      | `/mnt/skills/public/pdf/SKILL.md`              |
| Leitura de arquivos       | `/mnt/skills/public/file-reading/SKILL.md`     |
| Informações sobre produtos Anthropic | `/mnt/skills/public/product-self-knowledge/SKILL.md` |

---

## Convenções do Projeto

### Unidades de Medida (SEMPRE usar)
- Pressão: `Bar`
- Vazão: `m³/h`
- Comprimento: `mm`
- Temperatura: `°C`

### Cálculos
- SEMPRE mostrar a fórmula antes do resultado
- SEMPRE incluir unidades no resultado

### Dados e Fontes
- NUNCA inventar dados ou informações
- Quando faltar dado: marcar como `[Dados Insuficientes]`
- Pesquisa web: SEMPRE fornecer o link da fonte

### Tom e Comunicação
- Profissional, direto, objetivo e seguro
- Recomendações pragmáticas e acionáveis
- Sem rodeios ou disclaimers desnecessários

---

## Auto-Memória

Ao aprender algo relevante sobre este projeto (padrão de código, convenção, decisão arquitetural, bug recorrente), salvar automaticamente em memória com `/memory`.

Categorias de memória a manter atualizadas:
- `arquitetura` — decisões estruturais do projeto
- `padroes` — convenções de código adotadas
- `bugs-conhecidos` — problemas identificados e suas causas
- `dependencias` — bibliotecas críticas e versões fixadas

---

## Fluxo Resumido

```
Solicitação recebida
       │
       ▼
[Opus 4.7 · Plan Mode]
  Melhorar prompt
  Identificar lacunas
       │
       ▼
[Opus 4.7 · Plan Mode]
  Gerar plano detalhado
  Listar arquivos + riscos
       │
       ▼
  Aguardar aprovação ◄── GATE OBRIGATÓRIO
       │
       ▼ (aprovado)
[Sonnet 4.6 · Execute]
  Implementar conforme plano
  Reportar modificações
       │
       ▼
  Verificar critérios de sucesso
```

---

## Comandos Rápidos de Referência

```bash
# Iniciar sessão de planejamento
claude --model claude-opus-4-7

# Iniciar sessão de implementação
claude --model claude-sonnet-4-6

# Ativar Plan Mode (teclado)
Shift + Tab

# Ver e editar memórias
/memory

# Adicionar memória rápida
# [digite # no início da mensagem]
```

---

*Fonte: [Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code/overview) · [Memory Guide](https://code.claude.com/docs/en/memory)*

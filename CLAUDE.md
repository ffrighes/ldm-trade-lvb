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

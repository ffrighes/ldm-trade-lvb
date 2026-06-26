import type { BomVersionStatus } from '@/types/bom';

/** Tailwind class string for BOM version status badges — single source of truth. */
export const bomStatusColorClass: Record<BomVersionStatus, string> = {
  DRAFT: 'bg-warning text-warning-foreground',
  RELEASED: 'bg-success text-success-foreground',
  OBSOLETE: 'bg-muted text-muted-foreground',
};

/** shadcn Badge `variant` for Cálculo status badges — single source of truth. */
export const calculoStatusBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  Rascunho: 'secondary',
  'Em Revisão': 'outline',
  Aprovado: 'default',
};

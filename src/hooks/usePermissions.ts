import { useUserRole } from '@/hooks/useUserRole';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

type SolicitacaoStatus = 'Aberta' | 'Aprovada' | 'Material Comprado' | 'Material enviado para Obra' | 'Finalizada' | 'Cancelada';

export interface Permissions {
  // Solicitações
  canCreateSolicitacao: boolean;
  canEditSolicitacao: (status: string) => boolean;
  canDeleteSolicitacao: (status: string) => boolean;
  canChangeStatus: boolean;
  getAllowedStatuses: (currentStatus: string) => SolicitacaoStatus[];

  // Projetos
  canCreateProject: boolean;
  canEditProject: boolean;
  canDeleteProject: boolean;

  // Base de Dados
  canModifyBaseDados: boolean;

  // Inventário
  canModifyInventario: boolean;

  // Admin
  canAccessAdmin: boolean;

  // Loading state
  isLoading: boolean;
  role: AppRole | null | undefined;
}

const ALL_STATUSES: SolicitacaoStatus[] = [
  'Aberta',
  'Aprovada',
  'Material Comprado',
  'Material enviado para Obra',
  'Finalizada',
  'Cancelada',
];

export function usePermissions(): Permissions {
  const { data: role, isLoading } = useUserRole();

  return {
    canCreateSolicitacao: true,
    canEditSolicitacao: () => true,
    canDeleteSolicitacao: () => true,
    canChangeStatus: true,
    getAllowedStatuses: () => ALL_STATUSES,
    canCreateProject: true,
    canEditProject: true,
    canDeleteProject: true,
    canModifyBaseDados: true,
    canModifyInventario: true,
    canAccessAdmin: true,
    isLoading,
    role,
  };
}

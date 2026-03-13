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

export function usePermissions(): Permissions {
  const { data: role, isLoading } = useUserRole();

  const isAdmin = role === 'admin';
  const isGerente = role === 'gerente';
  const isProjetista = role === 'projetista';
  const isComprador = role === 'comprador';
  const isCoordenadorCampo = role === 'coordenador_campo';

  // Solicitações: admin, gerente, projetista, coordenador_campo can create
  const canCreateSolicitacao = isAdmin || isGerente || isProjetista || isCoordenadorCampo;

  // Editing solicitação content (not status)
  const canEditSolicitacao = (status: string): boolean => {
    if (isAdmin) return true;
    if (isGerente || isProjetista) return status === 'Aberta';
    if (isCoordenadorCampo) return status === 'Aberta';
    return false;
  };

  // Deleting solicitações
  const canDeleteSolicitacao = (status: string): boolean => {
    if (isAdmin) return true;
    if (isGerente) return status === 'Aberta';
    if (isCoordenadorCampo) return status === 'Aberta';
    return false;
  };

  // Can this role change status at all?
  const canChangeStatus = isAdmin || isGerente || isComprador || isCoordenadorCampo;

  // Get allowed status transitions based on role and current status
  const getAllowedStatuses = (currentStatus: string): SolicitacaoStatus[] => {
    const allStatuses: SolicitacaoStatus[] = [
      'Aberta', 'Aprovada', 'Material Comprado', 'Material enviado para Obra', 'Finalizada', 'Cancelada',
    ];

    if (isAdmin) return allStatuses;

    if (isGerente) return allStatuses;

    if (isComprador) {
      // Comprador: can change from Aprovada to "Material Comprado" or "Material enviado para Obra"
      if (currentStatus === 'Aprovada') {
        return ['Aprovada', 'Material Comprado', 'Material enviado para Obra'];
      }
      if (currentStatus === 'Material Comprado') {
        return ['Material Comprado', 'Material enviado para Obra'];
      }
      // Keep current status if no transitions allowed
      return [currentStatus as SolicitacaoStatus];
    }

    if (isCoordenadorCampo) {
      // Coordenador de Campo: can only cancel open solicitações
      if (currentStatus === 'Aberta') {
        return ['Aberta', 'Cancelada'];
      }
      return [currentStatus as SolicitacaoStatus];
    }

    // Projetista: cannot change status
    return [currentStatus as SolicitacaoStatus];
  };

  // Projetos: admin, gerente, projetista can create
  const canCreateProject = isAdmin || isGerente || isProjetista;
  const canEditProject = isAdmin || isGerente || isProjetista;
  const canDeleteProject = isAdmin || isGerente;

  // Base de Dados: admin, gerente, projetista can modify
  const canModifyBaseDados = isAdmin || isGerente || isProjetista;

  // Inventário: admin, gerente can modify
  const canModifyInventario = isAdmin || isGerente;

  // Admin page
  const canAccessAdmin = isAdmin;

  return {
    canCreateSolicitacao,
    canEditSolicitacao,
    canDeleteSolicitacao,
    canChangeStatus,
    getAllowedStatuses,
    canCreateProject,
    canEditProject,
    canDeleteProject,
    canModifyBaseDados,
    canModifyInventario,
    canAccessAdmin,
    isLoading,
    role,
  };
}

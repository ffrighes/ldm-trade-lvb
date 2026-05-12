import { useUserRole } from '@/hooks/useUserRole';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface Permissions {
  // Projetos
  canCreateProject: boolean;
  canEditProject: boolean;
  canDeleteProject: boolean;

  // Base de Dados
  canModifyBaseDados: boolean;

  // BOM hierárquica (PLM)
  canEditBomDraft: boolean;
  canReleaseBomVersion: boolean;
  canCloneBom: boolean;
  canDeleteBomRoot: boolean;
  canDeleteObsoleteVersion: boolean;
  canRevertObsoleteToDraft: boolean;

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

  const canCreateProject = isAdmin || isGerente || isProjetista;
  const canEditProject = isAdmin || isGerente || isProjetista;
  const canDeleteProject = isAdmin || isGerente;

  const canModifyBaseDados = isAdmin || isGerente || isProjetista;

  // BOM hierárquica: editores são admin/gerente/projetista
  const canEditBomDraft = isAdmin || isGerente || isProjetista;
  const canReleaseBomVersion = isAdmin || isGerente;
  const canCloneBom = isAdmin || isGerente || isProjetista;
  const canDeleteBomRoot = isAdmin || isGerente;
  const canDeleteObsoleteVersion = isAdmin || isGerente;
  const canRevertObsoleteToDraft = isAdmin || isGerente;

  const canAccessAdmin = isAdmin;

  return {
    canCreateProject,
    canEditProject,
    canDeleteProject,
    canModifyBaseDados,
    canEditBomDraft,
    canReleaseBomVersion,
    canCloneBom,
    canDeleteBomRoot,
    canDeleteObsoleteVersion,
    canRevertObsoleteToDraft,
    canAccessAdmin,
    isLoading,
    role,
  };
}

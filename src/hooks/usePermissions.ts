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

  const canAccessAdmin = isAdmin;

  return {
    canCreateProject,
    canEditProject,
    canDeleteProject,
    canModifyBaseDados,
    canAccessAdmin,
    isLoading,
    role,
  };
}

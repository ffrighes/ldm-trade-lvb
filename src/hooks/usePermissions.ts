import { useAuth, AppRole } from './useAuth';

// Permission definitions per role
const PERMISSIONS: Record<AppRole, {
  canCreateSolicitacao: boolean;
  canCreateProject: boolean;
  canModifyBaseDados: boolean;
  canChangeAnyStatus: boolean;
  canChangeStatusTo: string[];
  canCancelAberta: boolean;
  canManageUsers: boolean;
  canDeleteSolicitacao: boolean;
  canEditSolicitacao: boolean;
}> = {
  admin: {
    canCreateSolicitacao: true,
    canCreateProject: true,
    canModifyBaseDados: true,
    canChangeAnyStatus: true,
    canChangeStatusTo: [],
    canCancelAberta: true,
    canManageUsers: true,
    canDeleteSolicitacao: true,
    canEditSolicitacao: true,
  },
  gerente: {
    canCreateSolicitacao: true,
    canCreateProject: true,
    canModifyBaseDados: true,
    canChangeAnyStatus: true,
    canChangeStatusTo: [],
    canCancelAberta: true,
    canManageUsers: false,
    canDeleteSolicitacao: true,
    canEditSolicitacao: true,
  },
  projetista: {
    canCreateSolicitacao: true,
    canCreateProject: true,
    canModifyBaseDados: true,
    canChangeAnyStatus: false,
    canChangeStatusTo: [],
    canCancelAberta: false,
    canManageUsers: false,
    canDeleteSolicitacao: false,
    canEditSolicitacao: true,
  },
  comprador: {
    canCreateSolicitacao: false,
    canCreateProject: false,
    canModifyBaseDados: false,
    canChangeAnyStatus: false,
    canChangeStatusTo: ['Material Comprado', 'Material enviado para Obra'],
    canCancelAberta: false,
    canManageUsers: false,
    canDeleteSolicitacao: false,
    canEditSolicitacao: false,
  },
  coordenador_campo: {
    canCreateSolicitacao: true,
    canCreateProject: false,
    canModifyBaseDados: false,
    canChangeAnyStatus: false,
    canChangeStatusTo: ['Cancelada'],
    canCancelAberta: true,
    canManageUsers: false,
    canDeleteSolicitacao: false,
    canEditSolicitacao: false,
  },
};

export function usePermissions() {
  const { role } = useAuth();
  if (!role) return null;
  return PERMISSIONS[role];
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  gerente: 'Gerente',
  projetista: 'Projetista',
  comprador: 'Comprador',
  coordenador_campo: 'Coordenador de Campo',
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  role: AppRole | null;
}

async function callManageUsers(action: string, payload: Record<string, string | undefined> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Não autenticado.');

  const res = await supabase.functions.invoke('manage-users', {
    body: { action, ...payload },
  });

  if (res.error) throw new Error(res.error.message);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const data = await callManageUsers('list');
      return data.users as AdminUser[];
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, password, role }: { email: string; password: string; role?: string }) => {
      return callManageUsers('create', { email, password, role });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário criado com sucesso.');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar usuário: ${err.message}`);
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, email, password, role }: { id: string; email?: string; password?: string; role?: string }) => {
      const payload: Record<string, string | undefined> = { id };
      if (email) payload.email = email;
      if (password) payload.password = password;
      if (role !== undefined) payload.role = role;
      return callManageUsers('update', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário atualizado com sucesso.');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar usuário: ${err.message}`);
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return callManageUsers('delete', { id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário excluído com sucesso.');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir usuário: ${err.message}`);
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────

export interface Assembly {
  id: string;
  code: string;
  name: string;
  unit_weight: number | null;
  created_at: string;
  updated_at: string;
}

export interface AssemblyEdgeWithChild {
  parent_id: string;
  child_id: string;
  quantity: number;
  created_at: string;
  child: Assembly;
}

export interface AssemblyEdgeWithParent {
  parent_id: string;
  child_id: string;
  quantity: number;
  created_at: string;
  parent: Assembly;
}

export interface BomRow {
  descendant_id: string;
  level: number;
  effective_quantity: number;
  is_multi_path: boolean;
}

export interface AddToParentsEntry {
  parent_id: string;
  quantity: number;
}

// ─── Cycle-error parsing ──────────────────────────────────────────────

export function parseCycleError(message: string): string {
  if (message.includes('ciclo detectado')) return message;
  if (message.includes('duplicate key')) return 'Esta relação pai→filho já existe.';
  return message;
}

// ─── Queries ──────────────────────────────────────────────────────────

export function useAssemblies() {
  return useQuery({
    queryKey: ['assemblies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assemblies')
        .select('*')
        .order('code');
      if (error) throw error;
      return data as Assembly[];
    },
  });
}

export function useDirectChildren(parentId: string | undefined) {
  return useQuery({
    queryKey: ['assembly-children', parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assembly_edges')
        .select('*, child:assemblies!assembly_edges_child_id_fkey(*)')
        .eq('parent_id', parentId!)
        .order('child_id');
      if (error) throw error;
      return data as AssemblyEdgeWithChild[];
    },
  });
}

export function useDirectParents(childId: string | undefined) {
  return useQuery({
    queryKey: ['assembly-parents', childId],
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assembly_edges')
        .select('*, parent:assemblies!assembly_edges_parent_id_fkey(*)')
        .eq('child_id', childId!)
        .order('parent_id');
      if (error) throw error;
      return data as AssemblyEdgeWithParent[];
    },
  });
}

export function useExplodeBom(rootId: string | undefined) {
  return useQuery({
    queryKey: ['bom-explode', rootId],
    enabled: !!rootId,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('explode_bom', { p_root_id: rootId! });
      if (error) throw error;
      return data as BomRow[];
    },
  });
}

// Pre-check if adding edge would create cycle (client-side, authoritative check is on DB)
export async function checkWouldCycle(parentId: string, childId: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('assembly_would_cycle', { p_parent_id: parentId, p_child_id: childId });
  if (error) return false; // fail open — DB will be the final authority
  return data as boolean;
}

// ─── Mutations ────────────────────────────────────────────────────────

export function useCreateAssembly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { code: string; name: string; unit_weight?: number | null }) => {
      const { data, error } = await supabase
        .from('assemblies')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Assembly;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assemblies'] }),
  });
}

export function useUpdateAssembly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      code?: string;
      name?: string;
      unit_weight?: number | null;
    }) => {
      const { error } = await supabase.from('assemblies').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assemblies'] });
      qc.invalidateQueries({ queryKey: ['bom-explode'] });
    },
  });
}

export function useDeleteAssembly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assemblies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assemblies'] });
      qc.invalidateQueries({ queryKey: ['assembly-children'] });
      qc.invalidateQueries({ queryKey: ['assembly-parents'] });
      qc.invalidateQueries({ queryKey: ['bom-explode'] });
    },
  });
}

export function useAddToParents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      childId,
      parents,
    }: {
      childId: string;
      parents: AddToParentsEntry[];
    }) => {
      const { data, error } = await supabase.rpc('add_assembly_to_parents', {
        p_child_id: childId,
        p_parents: parents,
      });
      if (error) throw new Error(parseCycleError(error.message));
      return data;
    },
    onSuccess: (_data, { childId }) => {
      qc.invalidateQueries({ queryKey: ['assemblies'] });
      qc.invalidateQueries({ queryKey: ['assembly-parents', childId] });
      qc.invalidateQueries({ queryKey: ['assembly-children'] });
      qc.invalidateQueries({ queryKey: ['bom-explode'] });
    },
  });
}

export function useRemoveEdge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ parentId, childId }: { parentId: string; childId: string }) => {
      const { error } = await supabase
        .from('assembly_edges')
        .delete()
        .eq('parent_id', parentId)
        .eq('child_id', childId);
      if (error) throw error;
    },
    onSuccess: (_data, { parentId, childId }) => {
      qc.invalidateQueries({ queryKey: ['assembly-parents', childId] });
      qc.invalidateQueries({ queryKey: ['assembly-children', parentId] });
      qc.invalidateQueries({ queryKey: ['bom-explode'] });
    },
  });
}

export function useUpdateEdgeQuantity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      parentId,
      childId,
      quantity,
    }: {
      parentId: string;
      childId: string;
      quantity: number;
    }) => {
      const { error } = await supabase
        .from('assembly_edges')
        .update({ quantity })
        .eq('parent_id', parentId)
        .eq('child_id', childId);
      if (error) throw error;
    },
    onSuccess: (_data, { parentId, childId }) => {
      qc.invalidateQueries({ queryKey: ['assembly-children', parentId] });
      qc.invalidateQueries({ queryKey: ['assembly-parents', childId] });
      qc.invalidateQueries({ queryKey: ['bom-explode'] });
    },
  });
}

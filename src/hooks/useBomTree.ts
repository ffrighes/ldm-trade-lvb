import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  BomDiffRow,
  BomNode,
  BomNodeType,
  BomRoot,
  BomTreeNode,
  BomVersion,
} from '@/types/bom';

// The auto-generated Database types do not yet include the BOM tables.
// We use untyped accessors locally and cast through this minimal shim.
// Regenerate src/integrations/supabase/types.ts to remove the casts.
type AnyRecord = Record<string, unknown>;
type RpcResult = { data: unknown; error: unknown };
interface QueryBuilderLike {
  select: (q: string) => QueryBuilderLike;
  eq: (col: string, val: unknown) => QueryBuilderLike;
  order: (col: string, opts?: { ascending: boolean }) => QueryBuilderLike;
  then: <T>(onfulfilled: (v: { data: unknown; error: unknown }) => T) => Promise<T>;
}
const sb = supabase as unknown as {
  from: (table: string) => QueryBuilderLike;
  rpc: (fn: string, args?: AnyRecord) => Promise<RpcResult>;
};

// --------------------------------------------------------------------- queries

export function useBomRoots(projectId: string | undefined) {
  return useQuery({
    queryKey: ['bom-roots', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await sb
        .from('bom_root')
        .select('*')
        .eq('project_id', projectId)
        .order('codigo');
      if (error) throw error;
      return (data ?? []) as BomRoot[];
    },
  });
}

export function useBomVersions(rootId: string | undefined) {
  return useQuery({
    queryKey: ['bom-versions', rootId],
    enabled: !!rootId,
    queryFn: async () => {
      const { data, error } = await sb
        .from('bom_version')
        .select('*')
        .eq('root_id', rootId)
        .order('version_number', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BomVersion[];
    },
  });
}

export function useBomNodes(versionId: string | undefined) {
  return useQuery({
    queryKey: ['bom-nodes', versionId],
    enabled: !!versionId,
    queryFn: async () => {
      const { data, error } = await sb
        .from('bom_node')
        .select('*')
        .eq('version_id', versionId)
        .order('position');
      if (error) throw error;
      return (data ?? []) as BomNode[];
    },
  });
}

/** Build a tree from a flat node list and compute cumulative quantities. */
export function buildBomTree(nodes: BomNode[]): BomTreeNode | null {
  if (nodes.length === 0) return null;
  const byParent = new Map<string | null, BomNode[]>();
  for (const n of nodes) {
    const arr = byParent.get(n.parent_id) ?? [];
    arr.push(n);
    byParent.set(n.parent_id, arr);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.position - b.position);
  const roots = byParent.get(null) ?? [];
  if (roots.length === 0) return null;

  const build = (n: BomNode, parentCum: number): BomTreeNode => {
    const own = n.quantity ?? 1;
    const cum = n.node_type === 'CONJUNTO' ? 1 : own * parentCum;
    return {
      ...n,
      cumulativeQuantity: cum,
      children: (byParent.get(n.id) ?? []).map((c) => build(c, cum)),
    };
  };
  return build(roots[0], 1);
}

// ------------------------------------------------------------------ mutations

function invalidateVersion(qc: ReturnType<typeof useQueryClient>, versionId: string) {
  qc.invalidateQueries({ queryKey: ['bom-nodes', versionId] });
}

export function useCreateConjunto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      projectId: string;
      codigo: string;
      name: string;
      label?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await sb.rpc('bom_create_conjunto', {
        p_project_id: args.projectId,
        p_codigo: args.codigo,
        p_name: args.name,
        p_label: args.label ?? null,
        p_notes: args.notes ?? null,
      });
      if (error) throw error;
      return (data?.[0] ?? data) as { root_id: string; version_id: string; root_node_id: string };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['bom-roots', vars.projectId] });
    },
  });
}

export function useAddBomNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      versionId: string;
      parentId: string;
      nodeType: Exclude<BomNodeType, 'CONJUNTO'>;
      name?: string | null;
      materialId?: string | null;
      quantity?: number | null;
      position?: number | null;
      notes?: string | null;
    }) => {
      const { data, error } = await sb.rpc('bom_add_node', {
        p_version_id: args.versionId,
        p_parent_id: args.parentId,
        p_node_type: args.nodeType,
        p_name: args.name ?? null,
        p_material_id: args.materialId ?? null,
        p_quantity: args.quantity ?? null,
        p_position: args.position ?? null,
        p_notes: args.notes ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, vars) => invalidateVersion(qc, vars.versionId),
  });
}

export function useUpdateBomNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      versionId: string;
      nodeId: string;
      name?: string | null;
      quantity?: number | null;
      notes?: string | null;
      position?: number | null;
      clearNotes?: boolean;
    }) => {
      const { error } = await sb.rpc('bom_update_node', {
        p_node_id: args.nodeId,
        p_name: args.name ?? null,
        p_quantity: args.quantity ?? null,
        p_notes: args.notes ?? null,
        p_position: args.position ?? null,
        p_clear_notes: args.clearNotes ?? false,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => invalidateVersion(qc, vars.versionId),
  });
}

export function useMoveBomNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      versionId: string;
      nodeId: string;
      newParentId: string;
      newPosition: number;
    }) => {
      const { error } = await sb.rpc('bom_move_node', {
        p_node_id: args.nodeId,
        p_new_parent: args.newParentId,
        p_new_position: args.newPosition,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => invalidateVersion(qc, vars.versionId),
  });
}

export function useDuplicateBomSubtree() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { versionId: string; nodeId: string }) => {
      const { data, error } = await sb.rpc('bom_duplicate_subtree', { p_node_id: args.nodeId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, vars) => invalidateVersion(qc, vars.versionId),
  });
}

export function useRemoveBomSubtree() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { versionId: string; nodeId: string }) => {
      const { error } = await sb.rpc('bom_remove_subtree', { p_node_id: args.nodeId });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => invalidateVersion(qc, vars.versionId),
  });
}

export function useNewBomVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      rootId: string;
      sourceVersionId?: string | null;
      label?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await sb.rpc('bom_new_version', {
        p_root_id: args.rootId,
        p_source_version_id: args.sourceVersionId ?? null,
        p_label: args.label ?? null,
        p_notes: args.notes ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['bom-versions', vars.rootId] }),
  });
}

export function useReleaseBomVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { rootId: string; versionId: string }) => {
      const { error } = await sb.rpc('bom_release_version', { p_version_id: args.versionId });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['bom-versions', vars.rootId] }),
  });
}

export function useObsoleteBomVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { rootId: string; versionId: string }) => {
      const { error } = await sb.rpc('bom_obsolete_version', { p_version_id: args.versionId });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['bom-versions', vars.rootId] }),
  });
}

export function useCloneBomRoot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      sourceVersionId: string;
      targetProjectId: string;
      codigo: string;
      name: string;
      label?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await sb.rpc('bom_clone_root', {
        p_source_version_id: args.sourceVersionId,
        p_target_project_id: args.targetProjectId,
        p_codigo: args.codigo,
        p_name: args.name,
        p_label: args.label ?? null,
        p_notes: args.notes ?? null,
      });
      if (error) throw error;
      return (data?.[0] ?? data) as { root_id: string; version_id: string; root_node_id: string };
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['bom-roots', vars.targetProjectId] }),
  });
}

export function useUpdateBomRoot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { rootId: string; projectId: string; name: string }) => {
      const client = supabase as unknown as {
        from: (t: string) => {
          update: (v: AnyRecord) => {
            eq: (col: string, val: unknown) => Promise<{ error: unknown }>;
          };
        };
      };
      const { error } = await client
        .from('bom_root')
        .update({ name: args.name })
        .eq('id', args.rootId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['bom-roots', vars.projectId] });
    },
  });
}

export function useDeleteBomRoot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { rootId: string; projectId: string }) => {
      // Calls bom_drop_root (returns jsonb) instead of bom_delete_root (returns
      // void) — the former works around a gateway-level error seen in some
      // environments when the legacy void-return RPC is invoked from the browser.
      const { error } = await sb.rpc('bom_drop_root', { p_root_id: args.rootId });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['bom-roots', vars.projectId] });
      qc.removeQueries({ queryKey: ['bom-versions', vars.rootId] });
    },
  });
}

export function useBomDiff(versionA: string | undefined, versionB: string | undefined) {
  return useQuery({
    queryKey: ['bom-diff', versionA, versionB],
    enabled: !!versionA && !!versionB && versionA !== versionB,
    queryFn: async () => {
      const { data, error } = await sb.rpc('bom_diff_versions', {
        p_version_a: versionA,
        p_version_b: versionB,
      });
      if (error) throw error;
      return (data ?? []) as BomDiffRow[];
    },
  });
}

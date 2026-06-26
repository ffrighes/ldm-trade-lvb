import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  BomDiffRow,
  BomNode,
  BomNodeType,
  BomRoot,
  BomRootTreeNode,
  BomRootUsage,
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

/** Build a tree from a flat bom_root list (ordered by codigo). */
export function buildRootTree(roots: BomRoot[]): BomRootTreeNode[] {
  const byParent = new Map<string | null, BomRoot[]>();
  for (const r of roots) {
    const arr = byParent.get(r.parent_id) ?? [];
    arr.push(r);
    byParent.set(r.parent_id, arr);
  }

  const build = (parentId: string | null, depth: number): BomRootTreeNode[] =>
    (byParent.get(parentId) ?? []).map((r) => ({
      ...r,
      depth,
      children: build(r.id, depth + 1),
    }));

  return build(null, 0);
}

/** Returns the set of IDs that are descendants of rootId (inclusive). */
export function getDescendantIds(roots: BomRoot[], rootId: string): Set<string> {
  const result = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const parentId = queue.shift()!;
    for (const r of roots) {
      if (r.parent_id === parentId) {
        result.add(r.id);
        queue.push(r.id);
      }
    }
  }
  return result;
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
      parentId?: string | null;
      quantityInParent?: number;
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
      const result = (data?.[0] ?? data) as { root_id: string; version_id: string; root_node_id: string };
      // Set parent after creation if provided (bom_create_conjunto doesn't accept parent_id yet)
      if (args.parentId) {
        if (args.quantityInParent !== undefined && !(args.quantityInParent > 0)) {
          throw new Error('Quantidade no pai deve ser maior que zero.');
        }
        const setParentArgs: AnyRecord = {
          p_root_id: result.root_id,
          p_parent_id: args.parentId,
        };
        if (args.quantityInParent !== undefined) {
          setParentArgs.p_quantity = args.quantityInParent;
        }
        const { error: pe } = await sb.rpc('bom_root_set_parent', setParentArgs);
        if (pe) throw pe;
      }
      return result;
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
      materialId?: string | null;
      clearName?: boolean;
    }) => {
      const { error } = await sb.rpc('bom_update_node', {
        p_node_id: args.nodeId,
        p_name: args.name ?? null,
        p_quantity: args.quantity ?? null,
        p_notes: args.notes ?? null,
        p_position: args.position ?? null,
        p_clear_notes: args.clearNotes ?? false,
        p_material_id: args.materialId ?? null,
        p_clear_name: args.clearName ?? false,
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

/**
 * Reorders sibling BOM nodes by persisting a minimal batch of position updates.
 *
 * The cache (`['bom-nodes', versionId]`) is patched optimistically so the tree
 * reflows immediately; on any RPC error the previous order is restored. Updates
 * are applied through the existing `bom_update_node` RPC (position-only), which
 * is guarded server-side by `bom_assert_editor` + `bom_assert_draft`, so the
 * write also fails for non-editors or non-DRAFT versions.
 */
export function useReorderBomNodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      versionId: string;
      updates: { id: string; position: number }[];
    }) => {
      for (const u of args.updates) {
        const { error } = await sb.rpc('bom_update_node', {
          p_node_id: u.id,
          p_name: null,
          p_quantity: null,
          p_notes: null,
          p_position: u.position,
          p_clear_notes: false,
          p_material_id: null,
          p_clear_name: false,
        });
        if (error) throw error;
      }
    },
    onMutate: async (args) => {
      const key = ['bom-nodes', args.versionId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<BomNode[]>(key);
      const posById = new Map(args.updates.map((u) => [u.id, u.position]));
      qc.setQueryData<BomNode[]>(key, (old) =>
        old?.map((n) => (posById.has(n.id) ? { ...n, position: posById.get(n.id)! } : n)),
      );
      return { previous, key };
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(ctx.key, ctx.previous);
    },
    onSettled: (_d, _e, args) => {
      qc.invalidateQueries({ queryKey: ['bom-nodes', args.versionId] });
    },
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

export function useDeleteBomVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { rootId: string; versionId: string }) => {
      const { error } = await sb.rpc('bom_drop_obsolete_version', { p_version_id: args.versionId });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['bom-versions', vars.rootId] }),
  });
}

export function useRevertBomVersionToDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { rootId: string; versionId: string }) => {
      const { error } = await sb.rpc('bom_revert_version_to_draft', { p_version_id: args.versionId });
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
    mutationFn: async (args: {
      rootId: string;
      projectId: string;
      name: string;
      codigo?: string;
      /** Pass undefined to leave parent unchanged; null to unset; a uuid to set. */
      parentId?: string | null;
      /** Pass undefined to leave quantity unchanged. Must be > 0 when set. */
      quantityInParent?: number;
    }) => {
      if (args.quantityInParent !== undefined && !(args.quantityInParent > 0)) {
        throw new Error('Quantidade no pai deve ser maior que zero.');
      }
      const client = supabase as unknown as {
        from: (t: string) => {
          update: (v: AnyRecord) => {
            eq: (col: string, val: unknown) => Promise<{ error: unknown }>;
          };
        };
      };
      const payload: AnyRecord = { name: args.name };
      if (args.codigo !== undefined) payload.codigo = args.codigo;
      const { error } = await client
        .from('bom_root')
        .update(payload)
        .eq('id', args.rootId);
      if (error) throw error;

      if (args.parentId !== undefined) {
        const setParentArgs: AnyRecord = {
          p_root_id: args.rootId,
          p_parent_id: args.parentId,
        };
        if (args.quantityInParent !== undefined && args.parentId !== null) {
          setParentArgs.p_quantity = args.quantityInParent;
        }
        const { error: pe } = await sb.rpc('bom_root_set_parent', setParentArgs);
        if (pe) throw pe;
      } else if (args.quantityInParent !== undefined) {
        const { error: qe } = await sb.rpc('bom_root_set_quantity_in_parent', {
          p_root_id: args.rootId,
          p_quantity: args.quantityInParent,
        });
        if (qe) throw qe;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['bom-roots', vars.projectId] });
    },
  });
}

export function useSetBomRootQuantity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { rootId: string; projectId: string; quantity: number }) => {
      if (!(args.quantity > 0)) {
        throw new Error('Quantidade no pai deve ser maior que zero.');
      }
      const { error } = await sb.rpc('bom_root_set_quantity_in_parent', {
        p_root_id: args.rootId,
        p_quantity: args.quantity,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['bom-roots', vars.projectId] });
    },
  });
}

/** Alias of useSetBomRootQuantity with a more explicit name for use in RootQuantityField. */
export const useSetBomRootQuantityInParent = useSetBomRootQuantity;

/** Validates that a child quantity is a positive integer (≥ 1). */
function assertPositiveInteger(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('Quantidade deve ser um inteiro maior ou igual a 1.');
  }
}

/**
 * Optimistically updates a child Conjunto's `quantity_in_parent`.
 * Patches the `['bom-roots', projectId]` cache immediately and rolls back on
 * error, so the inline editor in the children list reflects the change without
 * waiting for the round-trip. Reconciles by invalidating on settle.
 */
export function useSetBomRootQuantityOptimistic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { rootId: string; projectId: string; quantity: number }) => {
      assertPositiveInteger(args.quantity);
      const { error } = await sb.rpc('bom_root_set_quantity_in_parent', {
        p_root_id: args.rootId,
        p_quantity: args.quantity,
      });
      if (error) throw error;
    },
    onMutate: async (args) => {
      const key = ['bom-roots', args.projectId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<BomRoot[]>(key);
      qc.setQueryData<BomRoot[]>(key, (old) =>
        old?.map((r) =>
          r.id === args.rootId ? { ...r, quantity_in_parent: args.quantity } : r,
        ),
      );
      return { previous, key };
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(ctx.key, ctx.previous);
    },
    onSettled: (_d, _e, args) => {
      qc.invalidateQueries({ queryKey: ['bom-roots', args.projectId] });
    },
  });
}

/**
 * Optimistically updates a catalog usage edge's `quantity`.
 * Writes directly to `bom_root_usage` (allowed by RLS for editors), patching the
 * `['bom-root-usages', parentRootId]` cache and rolling back on error.
 */
export function useSetChildUsageQuantity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { usageId: string; parentRootId: string; quantity: number }) => {
      assertPositiveInteger(args.quantity);
      const client = supabase as unknown as {
        from: (t: string) => {
          update: (v: AnyRecord) => {
            eq: (col: string, val: unknown) => Promise<{ error: unknown }>;
          };
        };
      };
      const { error } = await client
        .from('bom_root_usage')
        .update({ quantity: args.quantity })
        .eq('id', args.usageId);
      if (error) throw error;
    },
    onMutate: async (args) => {
      const key = ['bom-root-usages', args.parentRootId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<BomRootUsage[]>(key);
      qc.setQueryData<BomRootUsage[]>(key, (old) =>
        old?.map((u) => (u.id === args.usageId ? { ...u, quantity: args.quantity } : u)),
      );
      return { previous, key };
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(ctx.key, ctx.previous);
    },
    onSettled: (_d, _e, args) => {
      qc.invalidateQueries({ queryKey: ['bom-root-usages', args.parentRootId] });
    },
  });
}

export function useSetBomRootParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { rootId: string; projectId: string; parentId: string | null }) => {
      const { error } = await sb.rpc('bom_root_set_parent', {
        p_root_id: args.rootId,
        p_parent_id: args.parentId,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['bom-roots', vars.projectId] });
    },
  });
}

export function useDropBomRootCascade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { rootId: string; projectId: string }) => {
      const { error } = await sb.rpc('bom_drop_root_cascade', { p_root_id: args.rootId });
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

// ------------------------------------------------------------------ catalog

/** All standard catalog roots (is_standard = true). */
export function useStandardCatalog() {
  return useQuery({
    queryKey: ['bom-standard-catalog'],
    queryFn: async () => {
      const client = supabase as unknown as {
        from: (t: string) => QueryBuilderLike & {
          is: (col: string, val: boolean) => QueryBuilderLike;
        };
      };
      const { data, error } = await client
        .from('bom_root')
        .select('*')
        .is('is_standard', true as unknown as boolean)
        .order('codigo');
      if (error) throw error;
      return (data ?? []) as BomRoot[];
    },
  });
}

/** Usage edges (catalog children) for a given parent root. */
export function useBomRootUsages(parentRootId: string | undefined) {
  return useQuery({
    queryKey: ['bom-root-usages', parentRootId],
    enabled: !!parentRootId,
    queryFn: async () => {
      const { data, error } = await sb
        .from('bom_root_usage')
        .select('*')
        .eq('parent_root_id', parentRootId)
        .order('position');
      if (error) throw error;
      return (data ?? []) as BomRootUsage[];
    },
  });
}

export function useAddChildUsage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      parentRootId: string;
      childRootId: string;
      quantity?: number;
      position?: number;
      notes?: string | null;
    }) => {
      const { data, error } = await sb.rpc('bom_add_child_usage', {
        p_parent_root_id: args.parentRootId,
        p_child_root_id: args.childRootId,
        p_quantity: args.quantity ?? 1,
        p_position: args.position ?? 0,
        p_notes: args.notes ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['bom-root-usages', vars.parentRootId] });
    },
  });
}

export function useRemoveChildUsage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { usageId: string; parentRootId: string }) => {
      const { error } = await sb.rpc('bom_remove_child_usage', { p_usage_id: args.usageId });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['bom-root-usages', vars.parentRootId] });
    },
  });
}

export function useSetBomRootStandard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { rootId: string; projectId: string; isStandard: boolean }) => {
      const { error } = await sb.rpc('bom_set_standard', {
        p_root_id: args.rootId,
        p_is_standard: args.isStandard,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['bom-roots', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['bom-standard-catalog'] });
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

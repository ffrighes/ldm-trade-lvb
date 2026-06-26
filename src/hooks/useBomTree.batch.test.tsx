import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const rpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
  },
}));

import {
  useBatchRemoveBomNodes,
  useBatchMoveBomNodes,
  useBatchSetBomNodeQuantity,
} from './useBomTree';
import type { BomNode } from '@/types/bom';

let qc: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

beforeEach(() => {
  rpc.mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

const mk = (id: string): BomNode => ({
  id,
  version_id: 'v1',
  parent_id: 'r',
  node_type: 'ITEM',
  material_id: 'm1',
  name: id,
  quantity: 1,
  position: 0,
  notes: null,
  cloned_from_node_id: null,
  created_at: '',
  updated_at: '',
});

describe('useBatchRemoveBomNodes', () => {
  it('calls bom_batch_remove_subtrees with all ids and invalidates on success', async () => {
    rpc.mockResolvedValueOnce({ data: 2, error: null });
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useBatchRemoveBomNodes(), { wrapper });
    result.current.mutate({ versionId: 'v1', nodeIds: ['a', 'b'] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpc).toHaveBeenCalledWith('bom_batch_remove_subtrees', { p_node_ids: ['a', 'b'] });
    expect(result.current.data).toBe(2);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['bom-nodes', 'v1'] });
  });

  it('surfaces the error and leaves the cache untouched when the batch fails (atomic rollback)', async () => {
    // The whole-batch rollback happens server-side; on the client the cache is
    // never optimistically mutated, so a failed batch leaves no partial state.
    qc.setQueryData<BomNode[]>(['bom-nodes', 'v1'], [mk('a'), mk('b')]);
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Version is RELEASED' } });

    const { result } = renderHook(() => useBatchRemoveBomNodes(), { wrapper });
    result.current.mutate({ versionId: 'v1', nodeIds: ['a', 'b'] });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const cached = qc.getQueryData<BomNode[]>(['bom-nodes', 'v1']);
    expect(cached?.map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('useBatchMoveBomNodes', () => {
  it('calls bom_batch_move_nodes with ids and target parent on success', async () => {
    rpc.mockResolvedValueOnce({ data: 3, error: null });
    const { result } = renderHook(() => useBatchMoveBomNodes(), { wrapper });
    result.current.mutate({ versionId: 'v1', nodeIds: ['a', 'b', 'c'], newParentId: 'p2' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpc).toHaveBeenCalledWith('bom_batch_move_nodes', {
      p_node_ids: ['a', 'b', 'c'],
      p_new_parent: 'p2',
    });
  });

  it('surfaces a failed move without partial state', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Cannot move a node into its own subtree' } });
    const { result } = renderHook(() => useBatchMoveBomNodes(), { wrapper });
    result.current.mutate({ versionId: 'v1', nodeIds: ['a'], newParentId: 'a' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useBatchSetBomNodeQuantity', () => {
  it('rejects non-positive quantities without calling the RPC', async () => {
    const { result } = renderHook(() => useBatchSetBomNodeQuantity(), { wrapper });
    for (const bad of [0, -1]) {
      await expect(
        result.current.mutateAsync({ versionId: 'v1', nodeIds: ['a'], quantity: bad }),
      ).rejects.toThrow(/maior que zero/);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it('calls bom_batch_set_quantity with the new quantity on success', async () => {
    rpc.mockResolvedValueOnce({ data: 2, error: null });
    const { result } = renderHook(() => useBatchSetBomNodeQuantity(), { wrapper });
    result.current.mutate({ versionId: 'v1', nodeIds: ['a', 'b'], quantity: 5 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpc).toHaveBeenCalledWith('bom_batch_set_quantity', {
      p_node_ids: ['a', 'b'],
      p_quantity: 5,
    });
  });
});

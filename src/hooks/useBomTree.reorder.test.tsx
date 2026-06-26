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

import { useReorderBomNodes } from './useBomTree';
import type { BomNode } from '@/types/bom';

let qc: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

beforeEach(() => {
  rpc.mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

const mk = (id: string, position: number): BomNode => ({
  id,
  version_id: 'v1',
  parent_id: 'r',
  node_type: 'SUBCONJUNTO',
  material_id: null,
  name: id,
  quantity: 1,
  position,
  notes: null,
  cloned_from_node_id: null,
  created_at: '',
  updated_at: '',
});

describe('useReorderBomNodes', () => {
  it('optimistically applies the new positions while the RPC is pending', async () => {
    qc.setQueryData<BomNode[]>(['bom-nodes', 'v1'], [mk('a', 0), mk('b', 1), mk('c', 2)]);
    const d = deferred<{ data: null; error: null }>();
    rpc.mockReturnValue(d.promise);

    const { result } = renderHook(() => useReorderBomNodes(), { wrapper });
    result.current.mutate({
      versionId: 'v1',
      updates: [{ id: 'b', position: 0 }, { id: 'a', position: 1 }],
    });

    await waitFor(() => {
      const cached = qc.getQueryData<BomNode[]>(['bom-nodes', 'v1']);
      expect(cached?.find((n) => n.id === 'a')?.position).toBe(1);
      expect(cached?.find((n) => n.id === 'b')?.position).toBe(0);
      // Untouched sibling keeps its position.
      expect(cached?.find((n) => n.id === 'c')?.position).toBe(2);
    });

    d.resolve({ data: null, error: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('rolls back the cache when an RPC update fails', async () => {
    qc.setQueryData<BomNode[]>(['bom-nodes', 'v1'], [mk('a', 0), mk('b', 1)]);
    const d = deferred<{ data: null; error: { message: string } }>();
    rpc.mockReturnValue(d.promise);

    const { result } = renderHook(() => useReorderBomNodes(), { wrapper });
    result.current.mutate({
      versionId: 'v1',
      updates: [{ id: 'b', position: 0 }, { id: 'a', position: 1 }],
    });

    await waitFor(() => {
      expect(qc.getQueryData<BomNode[]>(['bom-nodes', 'v1'])?.find((n) => n.id === 'b')?.position).toBe(0);
    });

    d.resolve({ data: null, error: { message: 'network down' } });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const cached = qc.getQueryData<BomNode[]>(['bom-nodes', 'v1']);
    expect(cached?.find((n) => n.id === 'a')?.position).toBe(0);
    expect(cached?.find((n) => n.id === 'b')?.position).toBe(1);
  });

  it('issues one position-only bom_update_node call per changed sibling', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useReorderBomNodes(), { wrapper });
    result.current.mutate({
      versionId: 'v1',
      updates: [{ id: 'b', position: 0 }, { id: 'a', position: 1 }],
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith('bom_update_node', expect.objectContaining({
      p_node_id: 'b',
      p_position: 0,
      p_name: null,
      p_quantity: null,
      p_material_id: null,
    }));
  });
});

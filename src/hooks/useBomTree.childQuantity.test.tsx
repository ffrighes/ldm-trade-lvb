import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const rpc = vi.fn();
const update = vi.fn();
const eq = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => ({ update: (v: unknown) => { update(v); return { eq: (c: string, val: unknown) => eq(c, val) }; } }),
  },
}));

import {
  useSetBomRootQuantityOptimistic,
  useSetChildUsageQuantity,
} from './useBomTree';
import type { BomRoot, BomRootUsage } from '@/types/bom';

let qc: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

beforeEach(() => {
  rpc.mockReset();
  update.mockReset();
  eq.mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

const makeRoot = (id: string, qty: number): BomRoot => ({
  id,
  project_id: 'p1',
  parent_id: 'parent',
  codigo: id,
  name: id,
  created_by: null,
  created_at: '',
  updated_at: '',
  cloned_from_root_id: null,
  quantity_in_parent: qty,
  is_standard: false,
});

describe('useSetBomRootQuantityOptimistic', () => {
  it('rejects non-integer and < 1 quantities without calling the RPC', async () => {
    const { result } = renderHook(() => useSetBomRootQuantityOptimistic(), { wrapper });

    for (const bad of [0, -2, 1.5]) {
      await expect(
        result.current.mutateAsync({ rootId: 'r1', projectId: 'p1', quantity: bad }),
      ).rejects.toThrow(/inteiro maior ou igual a 1/);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it('optimistically patches the cache then rolls back on RPC error', async () => {
    qc.setQueryData<BomRoot[]>(['bom-roots', 'p1'], [makeRoot('r1', 2), makeRoot('r2', 5)]);
    // Keep the RPC pending so the optimistic state is observable, then fail it.
    const d = deferred<{ data: null; error: { message: string } }>();
    rpc.mockReturnValueOnce(d.promise);

    const { result } = renderHook(() => useSetBomRootQuantityOptimistic(), { wrapper });
    result.current.mutate({ rootId: 'r1', projectId: 'p1', quantity: 9 });

    // Optimistic value applied during onMutate, while the RPC is still pending.
    await waitFor(() => {
      const cached = qc.getQueryData<BomRoot[]>(['bom-roots', 'p1']);
      expect(cached?.find((r) => r.id === 'r1')?.quantity_in_parent).toBe(9);
    });

    // Resolve with an error → onError restores the previous value.
    d.resolve({ data: null, error: { message: 'network down' } });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const cached = qc.getQueryData<BomRoot[]>(['bom-roots', 'p1']);
    expect(cached?.find((r) => r.id === 'r1')?.quantity_in_parent).toBe(2);
    expect(cached?.find((r) => r.id === 'r2')?.quantity_in_parent).toBe(5);
  });

  it('calls the RPC with the new quantity on success', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(() => useSetBomRootQuantityOptimistic(), { wrapper });
    result.current.mutate({ rootId: 'r1', projectId: 'p1', quantity: 4 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpc).toHaveBeenCalledWith('bom_root_set_quantity_in_parent', {
      p_root_id: 'r1',
      p_quantity: 4,
    });
  });
});

const makeUsage = (id: string, qty: number): BomRootUsage => ({
  id,
  parent_root_id: 'parent',
  child_root_id: `child-${id}`,
  quantity: qty,
  position: 0,
  notes: null,
  created_at: '',
});

describe('useSetChildUsageQuantity', () => {
  it('rejects invalid quantities without touching the table', async () => {
    const { result } = renderHook(() => useSetChildUsageQuantity(), { wrapper });
    await expect(
      result.current.mutateAsync({ usageId: 'u1', parentRootId: 'parent', quantity: 0 }),
    ).rejects.toThrow(/inteiro maior ou igual a 1/);
    expect(update).not.toHaveBeenCalled();
  });

  it('optimistically patches the usage cache then rolls back on error', async () => {
    qc.setQueryData<BomRootUsage[]>(['bom-root-usages', 'parent'], [makeUsage('u1', 3)]);
    const d = deferred<{ error: { message: string } }>();
    eq.mockReturnValueOnce(d.promise);

    const { result } = renderHook(() => useSetChildUsageQuantity(), { wrapper });
    result.current.mutate({ usageId: 'u1', parentRootId: 'parent', quantity: 7 });

    await waitFor(() => {
      const cached = qc.getQueryData<BomRootUsage[]>(['bom-root-usages', 'parent']);
      expect(cached?.[0].quantity).toBe(7);
    });

    d.resolve({ error: { message: 'rls denied' } });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const cached = qc.getQueryData<BomRootUsage[]>(['bom-root-usages', 'parent']);
    expect(cached?.[0].quantity).toBe(3);
  });

  it('updates bom_root_usage with the new quantity on success', async () => {
    eq.mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useSetChildUsageQuantity(), { wrapper });
    result.current.mutate({ usageId: 'u1', parentRootId: 'parent', quantity: 6 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(update).toHaveBeenCalledWith({ quantity: 6 });
    expect(eq).toHaveBeenCalledWith('id', 'u1');
  });
});

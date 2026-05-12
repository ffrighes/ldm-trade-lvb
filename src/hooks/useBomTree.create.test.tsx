import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import { useCreateConjunto, useAddBomNode } from './useBomTree';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

beforeEach(() => rpc.mockReset());

describe('product structure creation', () => {
  it('useCreateConjunto calls bom_create_conjunto with the form payload', async () => {
    rpc.mockResolvedValueOnce({
      data: [{ root_id: 'r1', version_id: 'v1', root_node_id: 'n1' }],
      error: null,
    });

    const { result } = renderHook(() => useCreateConjunto(), { wrapper });
    result.current.mutate({
      projectId: 'p1',
      codigo: 'CJ-001',
      name: 'Conjunto Teste',
      label: 'rev A',
      notes: 'inicial',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpc).toHaveBeenCalledWith('bom_create_conjunto', {
      p_project_id: 'p1',
      p_codigo: 'CJ-001',
      p_name: 'Conjunto Teste',
      p_label: 'rev A',
      p_notes: 'inicial',
    });
    expect(result.current.data).toEqual({
      root_id: 'r1',
      version_id: 'v1',
      root_node_id: 'n1',
    });
  });

  it('useAddBomNode creates a SUBCONJUNTO under the root', async () => {
    rpc.mockResolvedValueOnce({ data: 'sub-id', error: null });

    const { result } = renderHook(() => useAddBomNode(), { wrapper });
    result.current.mutate({
      versionId: 'v1',
      parentId: 'n1',
      nodeType: 'SUBCONJUNTO',
      name: 'Sub A',
      quantity: 2,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpc).toHaveBeenCalledWith('bom_add_node', {
      p_version_id: 'v1',
      p_parent_id: 'n1',
      p_node_type: 'SUBCONJUNTO',
      p_name: 'Sub A',
      p_material_id: null,
      p_quantity: 2,
      p_position: null,
      p_notes: null,
    });
    expect(result.current.data).toBe('sub-id');
  });

  it('useAddBomNode creates an ITEM under a SUBCONJUNTO with a material reference', async () => {
    rpc.mockResolvedValueOnce({ data: 'item-id', error: null });

    const { result } = renderHook(() => useAddBomNode(), { wrapper });
    result.current.mutate({
      versionId: 'v1',
      parentId: 'sub-id',
      nodeType: 'ITEM',
      materialId: 'mat-42',
      quantity: 5,
      position: 0,
      notes: 'observação',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpc).toHaveBeenCalledWith('bom_add_node', {
      p_version_id: 'v1',
      p_parent_id: 'sub-id',
      p_node_type: 'ITEM',
      p_name: null,
      p_material_id: 'mat-42',
      p_quantity: 5,
      p_position: 0,
      p_notes: 'observação',
    });
  });

  it('propagates RPC errors so the mutation fails', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Permission denied: editor role required' },
    });

    const { result } = renderHook(() => useAddBomNode(), { wrapper });
    result.current.mutate({
      versionId: 'v1',
      parentId: 'n1',
      nodeType: 'ITEM',
      materialId: 'mat-1',
      quantity: 1,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as { message: string }).message).toMatch(/Permission denied/);
  });
});

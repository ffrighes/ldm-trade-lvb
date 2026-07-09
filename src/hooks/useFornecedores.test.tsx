import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { Fornecedor } from '@/types/orcamento';

// Resultado que o próximo await no chain do Supabase deve resolver.
let nextResult: { data: unknown; error: unknown } = { data: null, error: null };
// Registro de chamadas para asserções (from/insert/update/delete/eq/...).
let calls: { method: string; args: unknown[] }[] = [];

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  const chain = (name: string) => (...args: unknown[]) => {
    calls.push({ method: name, args });
    return builder;
  };
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single']) {
    builder[m] = chain(m);
  }
  builder.then = (onfulfilled: (v: unknown) => unknown) =>
    Promise.resolve(nextResult).then(onfulfilled);
  return builder;
}

const from = vi.fn((table: string) => {
  calls.push({ method: 'from', args: [table] });
  return makeBuilder();
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => from(...args) },
}));

import {
  useAddFornecedor,
  useRenameFornecedor,
  useDeleteFornecedor,
} from './useFornecedores';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

const SEED: Fornecedor[] = [
  { id: 'f1', nome: 'ACME', observacoes: '', created_at: '', created_by: null },
  { id: 'f2', nome: 'Beta', observacoes: '', created_at: '', created_by: null },
];

beforeEach(() => {
  calls = [];
  nextResult = { data: null, error: null };
  from.mockClear();
});

describe('useAddFornecedor', () => {
  it('insere um fornecedor e retorna a linha criada', async () => {
    nextResult = {
      data: { id: 'f9', nome: 'Nova', observacoes: 'obs', created_at: '', created_by: null },
      error: null,
    };
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddFornecedor(), { wrapper });

    result.current.mutate({ nome: 'Nova', observacoes: 'obs' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(from).toHaveBeenCalledWith('fornecedores');
    expect(calls.find((c) => c.method === 'insert')?.args[0]).toEqual({
      nome: 'Nova',
      observacoes: 'obs',
    });
    expect((result.current.data as Fornecedor).id).toBe('f9');
  });

  it('propaga erro do servidor', async () => {
    nextResult = { data: null, error: { message: 'insert failed' } };
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddFornecedor(), { wrapper });

    result.current.mutate({ nome: 'X' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRenameFornecedor', () => {
  it('renomeia via update(...).eq(id) e aplica update otimista na cache', async () => {
    nextResult = { data: null, error: null };
    const { qc, wrapper } = createWrapper();
    qc.setQueryData(['fornecedores'], SEED);
    const { result } = renderHook(() => useRenameFornecedor(), { wrapper });

    result.current.mutate({ id: 'f1', nome: 'ACME Renomeada' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls.find((c) => c.method === 'update')?.args[0]).toEqual({
      nome: 'ACME Renomeada',
    });
    expect(calls.find((c) => c.method === 'eq')?.args).toEqual(['id', 'f1']);
    const cache = qc.getQueryData<Fornecedor[]>(['fornecedores']);
    expect(cache?.find((f) => f.id === 'f1')?.nome).toBe('ACME Renomeada');
  });

  it('faz rollback da cache quando o update falha', async () => {
    nextResult = { data: null, error: { message: 'update failed' } };
    const { qc, wrapper } = createWrapper();
    qc.setQueryData(['fornecedores'], SEED);
    const { result } = renderHook(() => useRenameFornecedor(), { wrapper });

    result.current.mutate({ id: 'f1', nome: 'Falha' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const cache = qc.getQueryData<Fornecedor[]>(['fornecedores']);
    expect(cache?.find((f) => f.id === 'f1')?.nome).toBe('ACME');
  });
});

describe('useDeleteFornecedor', () => {
  it('remove via delete().eq(id) e aplica update otimista na cache', async () => {
    nextResult = { data: null, error: null };
    const { qc, wrapper } = createWrapper();
    qc.setQueryData(['fornecedores'], SEED);
    const { result } = renderHook(() => useDeleteFornecedor(), { wrapper });

    result.current.mutate('f1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls.some((c) => c.method === 'delete')).toBe(true);
    expect(calls.find((c) => c.method === 'eq')?.args).toEqual(['id', 'f1']);
    const cache = qc.getQueryData<Fornecedor[]>(['fornecedores']);
    expect(cache?.some((f) => f.id === 'f1')).toBe(false);
  });

  it('faz rollback da cache quando o delete falha', async () => {
    nextResult = { data: null, error: { message: 'delete failed' } };
    const { qc, wrapper } = createWrapper();
    qc.setQueryData(['fornecedores'], SEED);
    const { result } = renderHook(() => useDeleteFornecedor(), { wrapper });

    result.current.mutate('f1');

    await waitFor(() => expect(result.current.isError).toBe(true));
    const cache = qc.getQueryData<Fornecedor[]>(['fornecedores']);
    expect(cache?.some((f) => f.id === 'f1')).toBe(true);
  });
});

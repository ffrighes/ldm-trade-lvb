import { describe, it, expect } from 'vitest';
import { getVigentes } from '@/lib/fornecedoresUtils';
import type { PrecoComData } from '@/lib/fornecedoresUtils';

const mk = (overrides: Partial<PrecoComData> & { id: string; material_id: string }): PrecoComData => ({
  data_cotacao: '2026-01-01',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('getVigentes', () => {
  it('retorna lista vazia quando não há preços', () => {
    expect(getVigentes([])).toEqual([]);
  });

  it('retorna o único preço quando há apenas um', () => {
    const precos = [mk({ id: 'p1', material_id: 'm1' })];
    expect(getVigentes(precos)).toHaveLength(1);
  });

  it('mantém a cotação mais recente por material_id (data_cotacao)', () => {
    const precos = [
      mk({ id: 'p1', material_id: 'm1', data_cotacao: '2026-01-01' }),
      mk({ id: 'p2', material_id: 'm1', data_cotacao: '2026-03-15' }),
      mk({ id: 'p3', material_id: 'm1', data_cotacao: '2026-02-10' }),
    ];
    const result = getVigentes(precos);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p2');
  });

  it('desempata por created_at quando data_cotacao é igual', () => {
    const precos = [
      mk({ id: 'p1', material_id: 'm1', data_cotacao: '2026-03-15', created_at: '2026-03-15T08:00:00Z' }),
      mk({ id: 'p2', material_id: 'm1', data_cotacao: '2026-03-15', created_at: '2026-03-15T12:00:00Z' }),
    ];
    const result = getVigentes(precos);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p2');
  });

  it('retorna um vigente por material quando há múltiplos materiais', () => {
    const precos = [
      mk({ id: 'p1', material_id: 'm1', data_cotacao: '2026-01-01' }),
      mk({ id: 'p2', material_id: 'm1', data_cotacao: '2026-02-01' }),
      mk({ id: 'p3', material_id: 'm2', data_cotacao: '2026-01-15' }),
      mk({ id: 'p4', material_id: 'm2', data_cotacao: '2026-01-10' }),
    ];
    const result = getVigentes(precos);
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('p2');
    expect(ids).toContain('p3');
  });
});

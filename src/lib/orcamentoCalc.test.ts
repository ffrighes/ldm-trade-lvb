import { describe, it, expect } from 'vitest';
import { calcOrcamentoLinha, calcOrcamentoTotais } from './orcamentoCalc';

describe('calcOrcamentoLinha (modelo "por dentro")', () => {
  it('deriva o líquido a partir do preço com impostos', () => {
    // p_ci=100, t=0,18 (12+3+3) -> p_li=82,00
    const r = calcOrcamentoLinha({
      quantidade: 2,
      precoUnitComImpostos: 100,
      icmsPct: 12,
      pisCofinsPct: 3,
      ipiPct: 3,
    });
    expect(r.precoUnitLiquido).toBeCloseTo(82, 6);
    expect(r.totalLiquido).toBeCloseTo(164, 6);
    expect(r.totalComImpostos).toBeCloseTo(200, 6);
    expect(r.totalImpostos).toBeCloseTo(36, 6);
    expect(r.excedeImpostos).toBe(false);
  });

  it('sem impostos, líquido = preço com impostos', () => {
    const r = calcOrcamentoLinha({
      quantidade: 1,
      precoUnitComImpostos: 50,
      icmsPct: 0,
      pisCofinsPct: 0,
      ipiPct: 0,
    });
    expect(r.precoUnitLiquido).toBeCloseTo(50, 6);
    expect(r.totalImpostos).toBeCloseTo(0, 6);
  });

  it('marca excedeImpostos quando a soma dos percentuais passa de 100%', () => {
    const r = calcOrcamentoLinha({
      quantidade: 1,
      precoUnitComImpostos: 100,
      icmsPct: 60,
      pisCofinsPct: 30,
      ipiPct: 20,
    });
    expect(r.excedeImpostos).toBe(true);
    expect(r.precoUnitLiquido).toBeLessThan(0); // não clampado, apenas sinalizado
  });
});

describe('calcOrcamentoTotais', () => {
  it('soma os totais das linhas', () => {
    const totais = calcOrcamentoTotais([
      { quantidade: 2, precoUnitComImpostos: 100, icmsPct: 12, pisCofinsPct: 3, ipiPct: 3 },
      { quantidade: 1, precoUnitComImpostos: 50, icmsPct: 0, pisCofinsPct: 0, ipiPct: 0 },
    ]);
    expect(totais.totalComImpostos).toBeCloseTo(250, 6);
    expect(totais.totalLiquido).toBeCloseTo(214, 6);
    expect(totais.totalImpostos).toBeCloseTo(36, 6);
  });
});

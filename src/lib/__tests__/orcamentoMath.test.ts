import { describe, it, expect } from 'vitest';
import { calcPrecoFinal, calcTotalItem, bestPriceIndex } from '../orcamentoMath';

const BASE: Parameters<typeof calcPrecoFinal>[0] = {
  valor_unitario: 100,
  desconto_pct: 0,
  ipi_pct: 0,
  icms_pct: 0,
  pis_pct: 0,
  cofins_pct: 0,
};

describe('calcPrecoFinal', () => {
  it('lucro_real: sem desconto, IPI=5% — apenas base+IPI', () => {
    const r = calcPrecoFinal({ ...BASE, valor_unitario: 100, ipi_pct: 5 }, 'lucro_real');
    expect(r.base_liquida).toBeCloseTo(100);
    expect(r.ipi_valor).toBeCloseTo(5);
    expect(r.preco_final_unit).toBeCloseTo(105);
  });

  it('lucro_presumido: mesmo comportamento que lucro_real', () => {
    const r = calcPrecoFinal({ ...BASE, valor_unitario: 100, ipi_pct: 5 }, 'lucro_presumido');
    expect(r.preco_final_unit).toBeCloseTo(105);
  });

  it('lucro_real: desconto=10%, IPI=5%, ICMS=18% — ICMS informativo, não soma', () => {
    const r = calcPrecoFinal(
      { valor_unitario: 100, desconto_pct: 10, ipi_pct: 5, icms_pct: 18, pis_pct: 1.65, cofins_pct: 7.6 },
      'lucro_real',
    );
    // base_liquida = 100 * 0.9 = 90
    expect(r.base_liquida).toBeCloseTo(90);
    // ipi = 90 * 0.05 = 4.5
    expect(r.ipi_valor).toBeCloseTo(4.5);
    // preco_final = 90 + 4.5 = 94.5
    expect(r.preco_final_unit).toBeCloseTo(94.5);
    // icms informativo
    expect(r.icms_valor).toBeCloseTo(16.2);
  });

  it('simples_nacional: desconto=10%, todos os impostos somam ao custo', () => {
    const r = calcPrecoFinal(
      { valor_unitario: 100, desconto_pct: 10, ipi_pct: 5, icms_pct: 18, pis_pct: 1.65, cofins_pct: 7.6 },
      'simples_nacional',
    );
    // base=90, ipi=4.5, icms=16.2, pis=1.485, cofins=6.84
    expect(r.base_liquida).toBeCloseTo(90);
    expect(r.preco_final_unit).toBeCloseTo(90 + 4.5 + 16.2 + 1.485 + 6.84);
  });

  it('desconto=100% → preco_final_unit deve ser 0', () => {
    const r = calcPrecoFinal(
      { valor_unitario: 100, desconto_pct: 100, ipi_pct: 5, icms_pct: 18, pis_pct: 2, cofins_pct: 3 },
      'simples_nacional',
    );
    expect(r.base_liquida).toBeCloseTo(0);
    expect(r.preco_final_unit).toBeCloseTo(0);
  });

  it('valor_unitario=0 (sem cotação vigente) → preco_final_unit=0', () => {
    const r = calcPrecoFinal(
      { valor_unitario: 0, desconto_pct: 0, ipi_pct: 5, icms_pct: 18, pis_pct: 2, cofins_pct: 3 },
      'lucro_real',
    );
    expect(r.preco_final_unit).toBeCloseTo(0);
  });
});

describe('calcTotalItem', () => {
  it('total = preco_final_unit × quantidade', () => {
    const total = calcTotalItem(
      { valor_unitario: 100, desconto_pct: 0, ipi_pct: 5, icms_pct: 0, pis_pct: 0, cofins_pct: 0 },
      'lucro_real',
      3,
    );
    expect(total).toBeCloseTo(315);
  });
});

describe('bestPriceIndex', () => {
  it('retorna o índice do menor total', () => {
    expect(bestPriceIndex([300, 200, 250], [false, false, false])).toBe(1);
  });

  it('ignora fornecedores sem cotação vigente', () => {
    expect(bestPriceIndex([100, 200, 300], [true, false, false])).toBe(1);
  });

  it('retorna null se todos sem cotação vigente', () => {
    expect(bestPriceIndex([100, 200], [true, true])).toBeNull();
  });
});

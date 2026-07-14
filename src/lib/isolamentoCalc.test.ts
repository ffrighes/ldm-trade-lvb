import { describe, expect, it } from 'vitest';
import { calcularLinha, calcularTotais } from './isolamentoCalc';

// Oráculo calculado diretamente pelas fórmulas do enunciado (material_chapa="Inox",
// e_chapa=0.5mm, material_isol="PIR"): não havia tabela de referência externa fornecida.
describe('calcularLinha', () => {
  it('bitola 1/2" — comprimento 5m, isolamento 25mm', () => {
    const r = calcularLinha({
      bitola: '1/2',
      comprimentoM: 5,
      espessuraIsolMm: 25,
      materialChapa: 'Inox',
      espessuraChapaMm: 0.5,
      materialIsol: 'PIR',
    });
    expect(r.erro).toBeUndefined();
    expect(r.volumeIsolM3).toBeCloseTo(0.018197675445918878, 6);
    expect(r.areaChapaM2).toBeCloseTo(1.1206060995354792, 6);
    expect(r.pesoChapaKg).toBeCloseTo(4.482424398141917, 6);
    expect(r.pesoIsolKg).toBeCloseTo(0.8188953950663496, 6);
  });

  it('bitola 2" — comprimento 10m, isolamento 38mm', () => {
    const r = calcularLinha({
      bitola: '2',
      comprimentoM: 10,
      espessuraIsolMm: 38,
      materialChapa: 'Inox',
      espessuraChapaMm: 0.5,
      materialIsol: 'PIR',
    });
    expect(r.erro).toBeUndefined();
    expect(r.volumeIsolM3).toBeCloseTo(0.11738686613844401, 6);
    expect(r.areaChapaM2).toBeCloseTo(4.282933264638965, 6);
    expect(r.pesoChapaKg).toBeCloseTo(17.131733058555863, 6);
    expect(r.pesoIsolKg).toBeCloseTo(5.282408976229981, 6);
  });

  it('bitola 4" — comprimento 3.5m, isolamento 50mm', () => {
    const r = calcularLinha({
      bitola: '4',
      comprimentoM: 3.5,
      espessuraIsolMm: 50,
      materialChapa: 'Inox',
      espessuraChapaMm: 0.5,
      materialIsol: 'PIR',
    });
    expect(r.erro).toBeUndefined();
    expect(r.volumeIsolM3).toBeCloseTo(0.09032864277234055, 6);
    expect(r.areaChapaM2).toBeCloseTo(2.3563515698250246, 6);
    expect(r.pesoChapaKg).toBeCloseTo(9.425406279300098, 6);
    expect(r.pesoIsolKg).toBeCloseTo(4.064788924755325, 6);
  });

  it('bitola 8" — comprimento 12m, isolamento 50mm', () => {
    const r = calcularLinha({
      bitola: '8',
      comprimentoM: 12,
      espessuraIsolMm: 50,
      materialChapa: 'Inox',
      espessuraChapaMm: 0.5,
      materialIsol: 'PIR',
    });
    expect(r.erro).toBeUndefined();
    expect(r.volumeIsolM3).toBeCloseTo(0.507203850736765, 6);
    expect(r.areaChapaM2).toBeCloseTo(12.029032606889176, 6);
    expect(r.pesoChapaKg).toBeCloseTo(48.116130427556705, 6);
    expect(r.pesoIsolKg).toBeCloseTo(22.824173283154426, 6);
  });

  it('bitola 12" — comprimento 1m, isolamento 75mm', () => {
    const r = calcularLinha({
      bitola: '12',
      comprimentoM: 1,
      espessuraIsolMm: 75,
      materialChapa: 'Inox',
      espessuraChapaMm: 0.5,
      materialIsol: 'PIR',
    });
    expect(r.erro).toBeUndefined();
    expect(r.volumeIsolM3).toBeCloseTo(0.09397681724132168, 6);
    expect(r.areaChapaM2).toBeCloseTo(1.4886436789035236, 6);
    expect(r.pesoChapaKg).toBeCloseTo(5.954574715614095, 6);
    expect(r.pesoIsolKg).toBeCloseTo(4.2289567758594755, 6);
  });

  it('retorna erro para bitola inexistente, sem NaN', () => {
    const r = calcularLinha({
      bitola: '99',
      comprimentoM: 5,
      espessuraIsolMm: 25,
      materialChapa: 'Inox',
      espessuraChapaMm: 0.5,
      materialIsol: 'PIR',
    });
    expect(r.erro).toBe('Bitola não encontrada');
    expect(r.diametroTuboMm).toBeNull();
    expect(r.diametroIsolMm).toBeNull();
    expect(r.volumeIsolM3).toBe(0);
    expect(r.pesoChapaKg).toBe(0);
    expect(r.pesoIsolKg).toBe(0);
    expect(Number.isNaN(r.volumeIsolM3)).toBe(false);
  });

  it('retorna erro para material de chapa inexistente', () => {
    const r = calcularLinha({
      bitola: '2',
      comprimentoM: 5,
      espessuraIsolMm: 25,
      materialChapa: 'Cobre',
      espessuraChapaMm: 0.5,
      materialIsol: 'PIR',
    });
    expect(r.erro).toBe('Material de chapa não encontrado: Cobre');
    expect(Number.isNaN(r.pesoChapaKg)).toBe(false);
  });

  it('retorna erro para material de isolamento inexistente', () => {
    const r = calcularLinha({
      bitola: '2',
      comprimentoM: 5,
      espessuraIsolMm: 25,
      materialChapa: 'Inox',
      espessuraChapaMm: 0.5,
      materialIsol: 'Lã de Rocha',
    });
    expect(r.erro).toBe('Material de isolamento não encontrado: Lã de Rocha');
    expect(Number.isNaN(r.pesoIsolKg)).toBe(false);
  });
});

describe('calcularTotais', () => {
  it('soma apenas linhas sem erro', () => {
    const linhas = [
      calcularLinha({
        bitola: '1/2',
        comprimentoM: 5,
        espessuraIsolMm: 25,
        materialChapa: 'Inox',
        espessuraChapaMm: 0.5,
        materialIsol: 'PIR',
      }),
      calcularLinha({
        bitola: '2',
        comprimentoM: 10,
        espessuraIsolMm: 38,
        materialChapa: 'Inox',
        espessuraChapaMm: 0.5,
        materialIsol: 'PIR',
      }),
      calcularLinha({
        bitola: 'bitola-invalida',
        comprimentoM: 100,
        espessuraIsolMm: 100,
        materialChapa: 'Inox',
        espessuraChapaMm: 0.5,
        materialIsol: 'PIR',
      }),
    ];

    const totais = calcularTotais(linhas);
    expect(totais.totalChapaKg).toBeCloseTo(4.482424398141917 + 17.131733058555863, 6);
    expect(totais.totalIsolKg).toBeCloseTo(0.8188953950663496 + 5.282408976229981, 6);
  });

  it('retorna zeros para lista vazia', () => {
    const totais = calcularTotais([]);
    expect(totais.totalChapaKg).toBe(0);
    expect(totais.totalIsolKg).toBe(0);
  });
});

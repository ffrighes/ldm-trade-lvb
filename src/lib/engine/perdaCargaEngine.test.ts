import { describe, it, expect } from 'vitest';
import {
  G,
  PA_TO_BAR,
  calcArea,
  calcVelocidade,
  calcReynolds,
  calcFatorAtrito,
  calcPerdaAtritoPa,
  calcPerdaLocalizadaPa,
  calcPerdaElevacaoPa,
  calcLinha,
  calcCircuito,
} from './perdaCargaEngine';
import type { CircuitoHidraulico, LinhaHidraulica } from '@/types/perdaCarga';
import { FLUIDO_AGUA_20C } from '@/lib/catalogo';

// ── Helpers ───────────────────────────────────────────────────────────────────

let _seq = 0;
function makeId() { return `test-${++_seq}`; }

// ── calcArea ──────────────────────────────────────────────────────────────────

describe('calcArea', () => {
  it('D=100 mm → 7.854e-3 m²', () => {
    expect(calcArea(100)).toBeCloseTo(Math.PI * 0.0025, 8); // π*(0.1)²/4
  });
  it('D=50 mm → π*(0.025)²', () => {
    expect(calcArea(50)).toBeCloseTo(Math.PI * 0.025 * 0.025, 10);
  });
});

// ── calcVelocidade ────────────────────────────────────────────────────────────

describe('calcVelocidade', () => {
  it('Q=0 → v=0', () => {
    expect(calcVelocidade(0, 100)).toBe(0);
  });
  it('D=0 → v=0', () => {
    expect(calcVelocidade(10, 0)).toBe(0);
  });
  it('Q=3,6 m³/h, D=50 mm', () => {
    // Q=3.6/3600=0.001 m³/s; A=π*(0.025)²≈1.963e-3; v=0.001/1.963e-3≈0.509
    expect(calcVelocidade(3.6, 50)).toBeCloseTo(0.509, 2);
  });
});

// ── calcReynolds ──────────────────────────────────────────────────────────────

describe('calcReynolds', () => {
  it('v=1 m/s, D=25 mm, nu=1e-6 → Re=25000', () => {
    expect(calcReynolds(1, 25, 1e-6)).toBeCloseTo(25000, 0);
  });
  it('nu=0 → 0', () => {
    expect(calcReynolds(1, 25, 0)).toBe(0);
  });
});

// ── calcFatorAtrito ───────────────────────────────────────────────────────────

describe('calcFatorAtrito — laminar', () => {
  it('Re=1000, ε=0.046 mm, D=50 mm → f=64/1000=0.064, regime=laminar', () => {
    const { f, regiao } = calcFatorAtrito(1000, 0.046, 50);
    expect(f).toBeCloseTo(0.064, 5);
    expect(regiao).toBe('laminar');
  });
  it('Re=2299 → laminar', () => {
    const { regiao } = calcFatorAtrito(2299, 0.046, 50);
    expect(regiao).toBe('laminar');
  });
});

describe('calcFatorAtrito — turbulento', () => {
  it('Re=100000, smooth pipe (ε≈0) → f near 0.018 (Blasius reference)', () => {
    const { f, regiao } = calcFatorAtrito(100000, 0.001, 50);
    expect(f).toBeGreaterThan(0.01);
    expect(f).toBeLessThan(0.03);
    expect(regiao).toBe('turbulento');
  });
  it('Re=4000 → turbulento', () => {
    const { regiao } = calcFatorAtrito(4000, 0.046, 50);
    expect(regiao).toBe('turbulento');
  });
});

describe('calcFatorAtrito — transição', () => {
  it('Re=3000 → transicao, f entre laminar e turbulento', () => {
    const { f: fLam  } = calcFatorAtrito(2300, 0.046, 50);
    const { f: fTurb } = calcFatorAtrito(4000, 0.046, 50);
    const { f, regiao } = calcFatorAtrito(3000, 0.046, 50);
    expect(regiao).toBe('transicao');
    expect(f).toBeGreaterThan(Math.min(fLam, fTurb) - 1e-6);
    expect(f).toBeLessThan(Math.max(fLam, fTurb) + 1e-6);
  });
});

// ── calcPerdaAtritoPa ─────────────────────────────────────────────────────────

describe('calcPerdaAtritoPa', () => {
  it('f=0.02, L=10000 mm, D=50 mm, ρ=998 kg/m³, v=1 m/s', () => {
    // ΔP = 0.02 * (10/0.05) * (998*1/2) = 0.02 * 200 * 499 = 1996 Pa
    expect(calcPerdaAtritoPa(0.02, 10000, 50, 998, 1)).toBeCloseTo(1996, 0);
  });
  it('D=0 → 0', () => {
    expect(calcPerdaAtritoPa(0.02, 10000, 0, 998, 1)).toBe(0);
  });
});

// ── calcPerdaLocalizadaPa ─────────────────────────────────────────────────────

describe('calcPerdaLocalizadaPa', () => {
  it('K=0.75, ρ=998, v=1 m/s, qtd=1 → 0.75*998/2 = 374.25 Pa', () => {
    expect(calcPerdaLocalizadaPa(0.75, 998, 1, 1)).toBeCloseTo(374.25, 1);
  });
  it('qtd=3 multiplies result by 3', () => {
    const single = calcPerdaLocalizadaPa(0.75, 998, 1, 1);
    expect(calcPerdaLocalizadaPa(0.75, 998, 1, 3)).toBeCloseTo(single * 3, 5);
  });
});

// ── calcPerdaElevacaoPa ───────────────────────────────────────────────────────

describe('calcPerdaElevacaoPa', () => {
  it('Δz=1000 mm (1 m), ρ=998.2 → 998.2*9.80665*1 ≈ 9790 Pa', () => {
    expect(calcPerdaElevacaoPa(1000, 998.2)).toBeCloseTo(998.2 * G, 1);
  });
  it('descida Δz=-500 mm → negative Pa', () => {
    expect(calcPerdaElevacaoPa(-500, 998.2)).toBeLessThan(0);
  });
  it('Δz=0 → 0 Pa', () => {
    expect(calcPerdaElevacaoPa(0, 998.2)).toBe(0);
  });
});

// ── Unit conversions ──────────────────────────────────────────────────────────

describe('unit conversions', () => {
  it('1 bar = 100000 Pa', () => {
    expect(1 / PA_TO_BAR).toBeCloseTo(100000, 0);
  });
  it('G constant = 9.80665', () => {
    expect(G).toBe(9.80665);
  });
  it('1 bar em m.c.a (ρ=998.2) ≈ 10.20 m', () => {
    const dp_Pa = 1 / PA_TO_BAR; // 100000 Pa
    const mca = dp_Pa / (998.2 * G);
    expect(mca).toBeCloseTo(10.20, 1);
  });
});

// ── calcLinha ─────────────────────────────────────────────────────────────────

describe('calcLinha — trecho simples', () => {
  it('trecho de aço, D=50 mm, L=10 m, Q=5 m³/h, sem desnível', () => {
    const linha: LinhaHidraulica = {
      id: 'l1',
      nome: 'Teste',
      vazao: 5,
      elementos: [
        {
          id: makeId(),
          tipo: 'trecho',
          material: 'Aço comercial novo',
          diametro: 50,
          comprimento: 10000,
          desnivel: 0,
          rugosidade: 0.046,
          quantidade: 1,
        },
      ],
    };
    const result = calcLinha(linha, FLUIDO_AGUA_20C);
    expect(result.bloqueada).toBe(false);
    expect(result.dpTotalBar).toBeGreaterThan(0);
    expect(result.elementos[0].regiao).toBe('turbulento');
    expect(result.elementos[0].velocidade).toBeGreaterThan(0);
    expect(result.elementos[0].reynolds).toBeGreaterThan(4000);
  });

  it('desnível negativo reduz ΔP total', () => {
    const base: LinhaHidraulica = {
      id: 'l1', nome: 'T', vazao: 5,
      elementos: [{
        id: makeId(), tipo: 'trecho', material: 'Aço comercial novo',
        diametro: 50, comprimento: 10000, desnivel: 0, rugosidade: 0.046, quantidade: 1,
      }],
    };
    const descida: LinhaHidraulica = {
      ...base,
      elementos: [{ ...base.elementos[0], id: makeId(), desnivel: -1000 }],
    };
    const r0 = calcLinha(base, FLUIDO_AGUA_20C);
    const rd = calcLinha(descida, FLUIDO_AGUA_20C);
    expect(rd.dpTotalBar).toBeLessThan(r0.dpTotalBar);
  });
});

describe('calcLinha — soma de K', () => {
  it('3 curvas 90° em série', () => {
    const linha: LinhaHidraulica = {
      id: 'l2', nome: 'Curvas', vazao: 5,
      elementos: [
        { id: makeId(), tipo: 'curva', subtipo: 'curva_90_padrao', label: 'Curva 90°', diametro: 50, k: 0.75, quantidade: 3 },
      ],
    };
    const result = calcLinha(linha, FLUIDO_AGUA_20C);
    expect(result.bloqueada).toBe(false);
    // ΔP = 3 * 0.75 * ρv²/2
    const v   = calcVelocidade(5, 50);
    const exp = calcPerdaLocalizadaPa(0.75, FLUIDO_AGUA_20C.densidade, v, 3);
    expect(result.dpTotalBar).toBeCloseTo(exp * PA_TO_BAR, 6);
  });
});

describe('calcLinha — filtro bloqueado', () => {
  it('filtro cv_fabricante sem cv → linha bloqueada', () => {
    const linha: LinhaHidraulica = {
      id: 'l3', nome: 'Filtro', vazao: 5,
      elementos: [
        { id: makeId(), tipo: 'filtro', diametro: 50, modo: 'cv_fabricante', quantidade: 1 },
      ],
    };
    const result = calcLinha(linha, FLUIDO_AGUA_20C);
    expect(result.bloqueada).toBe(true);
    expect(result.dpTotalBar).toBe(0);
  });
});

describe('calcLinha — regime laminar', () => {
  it('baixa vazão → laminar', () => {
    const linha: LinhaHidraulica = {
      id: 'l4', nome: 'Lam', vazao: 0.01,
      elementos: [{
        id: makeId(), tipo: 'trecho', material: 'Aço comercial novo',
        diametro: 10, comprimento: 1000, desnivel: 0, rugosidade: 0.046, quantidade: 1,
      }],
    };
    const result = calcLinha(linha, FLUIDO_AGUA_20C);
    expect(result.elementos[0].regiao).toBe('laminar');
  });
});

// ── calcCircuito ──────────────────────────────────────────────────────────────

describe('calcCircuito', () => {
  it('duas linhas em série — ΔP total = soma das linhas', () => {
    const circuito: CircuitoHidraulico = {
      fluido: FLUIDO_AGUA_20C,
      linhas: [
        {
          id: 'l1', nome: 'Linha 1', vazao: 5,
          elementos: [{
            id: makeId(), tipo: 'trecho', material: 'Aço comercial novo',
            diametro: 50, comprimento: 5000, desnivel: 0, rugosidade: 0.046, quantidade: 1,
          }],
        },
        {
          id: 'l2', nome: 'Linha 2', vazao: 5,
          elementos: [{
            id: makeId(), tipo: 'curva', subtipo: 'curva_90_padrao', label: 'Curva 90°',
            diametro: 50, k: 0.75, quantidade: 2,
          }],
        },
      ],
    };
    const result = calcCircuito(circuito);
    const r1 = calcLinha(circuito.linhas[0], FLUIDO_AGUA_20C);
    const r2 = calcLinha(circuito.linhas[1], FLUIDO_AGUA_20C);
    expect(result.dpTotalBar).toBeCloseTo(r1.dpTotalBar + r2.dpTotalBar, 8);
  });
});

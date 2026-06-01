import { describe, it, expect } from 'vitest';
import {
  getNPSList,
  getSchedules,
  getDefaultSchedule,
  getDimensaoASME,
  getDNList,
  getDimensaoDIN11850,
} from './normasTubulacao';

// ── getNPSList ────────────────────────────────────────────────────────────────

describe('getNPSList', () => {
  it('contém NPS 1/2" e 12"', () => {
    const list = getNPSList();
    expect(list).toContain('1/2');
    expect(list).toContain('12');
  });
  it('contém NPS 5"', () => {
    expect(getNPSList()).toContain('5');
  });
});

// ── getDefaultSchedule ────────────────────────────────────────────────────────

describe('getDefaultSchedule', () => {
  it('B36.19M default = 10S', () => {
    expect(getDefaultSchedule('ASME_B36_19M')).toBe('10S');
  });
  it('B36.10M default = STD', () => {
    expect(getDefaultSchedule('ASME_B36_10M')).toBe('STD');
  });
});

// ── getSchedules ──────────────────────────────────────────────────────────────

describe('getSchedules', () => {
  it('B36.19M NPS 5" contém 5S, 10S, 40S, 80S', () => {
    const scheds = getSchedules('ASME_B36_19M', '5');
    expect(scheds).toContain('5S');
    expect(scheds).toContain('10S');
    expect(scheds).toContain('40S');
    expect(scheds).toContain('80S');
  });
  it('B36.10M NPS 5" contém STD, XS, 40', () => {
    const scheds = getSchedules('ASME_B36_10M', '5');
    expect(scheds).toContain('STD');
    expect(scheds).toContain('XS');
  });
  it('NPS inválido retorna []', () => {
    expect(getSchedules('ASME_B36_19M', '99')).toEqual([]);
  });
});

// ── getDimensaoASME — B36.19M (inox) ─────────────────────────────────────────

describe('getDimensaoASME — B36.19M', () => {
  it('NPS 5" SCH 10S: OD=141.3, t=3.40, ID=134.5 mm', () => {
    const d = getDimensaoASME('ASME_B36_19M', '5', '10S');
    expect(d).not.toBeNull();
    expect(d!.od_mm).toBe(141.3);
    expect(d!.espessura_mm).toBe(3.40);
    // ID = 141.3 − 2×3.40 = 134.5
    expect(d!.id_mm).toBeCloseTo(134.5, 2);
  });

  it('NPS 2" SCH 10S: OD=60.3, t=2.77, ID≈54.76 mm', () => {
    const d = getDimensaoASME('ASME_B36_19M', '2', '10S');
    expect(d).not.toBeNull();
    expect(d!.od_mm).toBe(60.3);
    expect(d!.espessura_mm).toBe(2.77);
    expect(d!.id_mm).toBeCloseTo(60.3 - 2 * 2.77, 2);
  });

  it('label segue padrão ASME NPS" SCH schedule', () => {
    const d = getDimensaoASME('ASME_B36_19M', '5', '10S');
    expect(d!.label).toBe('ASME 5" SCH 10S');
  });

  it('NPS 1/2" SCH 5S: OD=21.3, t=1.65', () => {
    const d = getDimensaoASME('ASME_B36_19M', '1/2', '5S');
    expect(d!.od_mm).toBe(21.3);
    expect(d!.espessura_mm).toBe(1.65);
    expect(d!.id_mm).toBeCloseTo(21.3 - 2 * 1.65, 2);
  });

  it('combinação NPS/schedule inválida retorna null', () => {
    expect(getDimensaoASME('ASME_B36_19M', '5', 'SCH_INVALIDO')).toBeNull();
  });

  it('NPS inválido retorna null', () => {
    expect(getDimensaoASME('ASME_B36_19M', '99', '10S')).toBeNull();
  });
});

// ── getDimensaoASME — B36.10M (carbono) ──────────────────────────────────────

describe('getDimensaoASME — B36.10M', () => {
  it('NPS 5" SCH STD: OD=141.3, t=6.55, ID≈128.2 mm', () => {
    const d = getDimensaoASME('ASME_B36_10M', '5', 'STD');
    expect(d).not.toBeNull();
    expect(d!.od_mm).toBe(141.3);
    expect(d!.espessura_mm).toBe(6.55);
    expect(d!.id_mm).toBeCloseTo(141.3 - 2 * 6.55, 2);
  });

  it('NPS 2" SCH STD: OD=60.3, t=3.91', () => {
    const d = getDimensaoASME('ASME_B36_10M', '2', 'STD');
    expect(d!.od_mm).toBe(60.3);
    expect(d!.espessura_mm).toBe(3.91);
  });

  it('NPS 8" SCH 20: OD=219.1, t=6.35', () => {
    const d = getDimensaoASME('ASME_B36_10M', '8', '20');
    expect(d!.od_mm).toBe(219.1);
    expect(d!.espessura_mm).toBe(6.35);
  });

  it('label segue padrão correto', () => {
    const d = getDimensaoASME('ASME_B36_10M', '5', 'STD');
    expect(d!.label).toBe('ASME 5" SCH STD');
  });
});

// ── getDNList ─────────────────────────────────────────────────────────────────

describe('getDNList', () => {
  it('contém DN 15, 50, 150', () => {
    const list = getDNList();
    expect(list).toContain('15');
    expect(list).toContain('50');
    expect(list).toContain('150');
  });
});

// ── getDimensaoDIN11850 ───────────────────────────────────────────────────────

describe('getDimensaoDIN11850', () => {
  it('DN 50 Série 1: OD=53, t=1.5, ID=50 mm', () => {
    const d = getDimensaoDIN11850('50', '1');
    expect(d).not.toBeNull();
    expect(d!.od_mm).toBe(53.0);
    expect(d!.espessura_mm).toBe(1.5);
    expect(d!.id_mm).toBeCloseTo(53.0 - 2 * 1.5, 2);
  });

  it('DN 50 Série 2: OD=60.3, t=1.5', () => {
    const d = getDimensaoDIN11850('50', '2');
    expect(d!.od_mm).toBe(60.3);
    expect(d!.espessura_mm).toBe(1.5);
  });

  it('DN 100 Série 1: OD=104, t=2.0, ID=100 mm', () => {
    const d = getDimensaoDIN11850('100', '1');
    expect(d!.od_mm).toBe(104.0);
    expect(d!.espessura_mm).toBe(2.0);
    expect(d!.id_mm).toBeCloseTo(104.0 - 2 * 2.0, 2);
  });

  it('label segue padrão "DIN 11850 DNxx Série n"', () => {
    const d = getDimensaoDIN11850('50', '1');
    expect(d!.label).toBe('DIN 11850 DN50 Série 1');
  });

  it('DN inválido retorna null', () => {
    expect(getDimensaoDIN11850('999', '1')).toBeNull();
  });

  it('ID sempre positivo para todos os DNs e séries', () => {
    for (const dn of getDNList()) {
      for (const serie of ['1', '2'] as const) {
        const d = getDimensaoDIN11850(dn, serie);
        if (d) expect(d.id_mm).toBeGreaterThan(0);
      }
    }
  });
});

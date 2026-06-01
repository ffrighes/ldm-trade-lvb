/**
 * Tabelas dimensionais de tubulação por norma.
 *
 * Fontes:
 *   ASME B36.10M-2015 — Welded and Seamless Wrought Steel Pipe
 *   ASME B36.19M-2004 — Stainless Steel Pipe
 *   DIN 11850:1999 / EN 10357:2012 — Tubes for the food industry (stainless)
 *
 * Todos os valores em mm. Validar contra a norma original antes de uso em projeto.
 * ID = OD − 2 × espessura_parede
 */

export type NormaId = 'ASME_B36_10M' | 'ASME_B36_19M' | 'DIN_11850';

// ── OD por NPS ────────────────────────────────────────────────────────────────
// Idêntico em B36.10M e B36.19M (ASME B36.10M-2015, Tabela 1)
const NPS_OD_MM: Record<string, number> = {
  '1/2':    21.3,
  '3/4':    26.7,
  '1':      33.4,
  '1-1/4':  42.2,
  '1-1/2':  48.3,
  '2':      60.3,
  '2-1/2':  73.0,
  '3':      88.9,
  '3-1/2': 101.6,
  '4':     114.3,
  '5':     141.3,
  '6':     168.3,
  '8':     219.1,
  '10':    273.1,
  '12':    323.9,
};

// ── ASME B36.10M — Espessura de parede (mm) por NPS e schedule ────────────────
// Nota: STD = SCH 40 para NPS ≤ 10"; XS = SCH 80 para NPS ≤ 8"
// Fonte: ASME B36.10M-2015, Tabela 1
const B36_10M_WT: Record<string, Record<string, number>> = {
  '1/2':   { '10': 2.11, 'STD': 2.77, '40': 2.77, 'XS': 3.73,  '80': 3.73,  '160': 4.78  },
  '3/4':   { '10': 2.11, 'STD': 2.87, '40': 2.87, 'XS': 3.91,  '80': 3.91,  '160': 5.56  },
  '1':     { '10': 2.77, 'STD': 3.38, '40': 3.38, 'XS': 4.55,  '80': 4.55,  '160': 6.35  },
  '1-1/4': { '10': 2.77, 'STD': 3.56, '40': 3.56, 'XS': 4.85,  '80': 4.85,  '160': 6.35  },
  '1-1/2': { '10': 2.77, 'STD': 3.68, '40': 3.68, 'XS': 5.08,  '80': 5.08,  '160': 7.14  },
  '2':     { '10': 2.77, 'STD': 3.91, '40': 3.91, 'XS': 5.54,  '80': 5.54,  '160': 8.74  },
  '2-1/2': { '10': 3.05, 'STD': 5.16, '40': 5.16, 'XS': 7.01,  '80': 7.01,  '160': 9.53  },
  '3':     { '10': 3.05, 'STD': 5.49, '40': 5.49, 'XS': 7.62,  '80': 7.62,  '160': 11.13 },
  '3-1/2': { '10': 3.05, 'STD': 5.74, '40': 5.74, 'XS': 8.08,  '80': 8.08                },
  '4':     { '10': 3.05, 'STD': 6.02, '40': 6.02, 'XS': 8.56,  '80': 8.56,  '120': 11.13, '160': 13.49 },
  '5':     { '10': 3.40, 'STD': 6.55, '40': 6.55, 'XS': 9.52,  '80': 9.52,  '120': 12.70, '160': 15.88 },
  '6':     { '10': 3.40, 'STD': 7.11, '40': 7.11, 'XS': 10.97, '80': 10.97, '120': 14.27, '160': 18.26 },
  '8':     { '10': 3.76, '20': 6.35, '30': 7.04, 'STD': 8.18, '40': 8.18, '60': 10.31, 'XS': 12.70, '80': 12.70, '100': 15.09, '120': 17.48, '140': 19.05, '160': 23.01 },
  '10':    { '10': 4.19, '20': 6.35, 'STD': 9.27, '40': 9.27,  'XS': 12.70, '60': 14.27, '80': 15.09, '100': 18.26, '120': 21.44, '140': 25.40, '160': 28.58 },
  '12':    { '10': 4.57, '20': 6.35, 'STD': 9.53, '30': 10.31, '40': 10.31, 'XS': 12.70, '60': 14.27, '80': 17.48, '100': 20.62, '120': 24.61, '140': 28.58, '160': 33.32 },
};

// ── ASME B36.19M — Espessura de parede (mm) por NPS e schedule-S ─────────────
// Sufixo "S" distingue dos schedules do B36.10M
// Fonte: ASME B36.19M-2004, Tabela 1
const B36_19M_WT: Record<string, Record<string, number>> = {
  '1/2':   { '5S': 1.65, '10S': 2.11, '40S': 2.77, '80S': 3.73  },
  '3/4':   { '5S': 1.65, '10S': 2.11, '40S': 2.87, '80S': 3.91  },
  '1':     { '5S': 1.65, '10S': 2.77, '40S': 3.38, '80S': 4.55  },
  '1-1/4': { '5S': 1.65, '10S': 2.77, '40S': 3.56, '80S': 4.85  },
  '1-1/2': { '5S': 1.65, '10S': 2.77, '40S': 3.68, '80S': 5.08  },
  '2':     { '5S': 1.65, '10S': 2.77, '40S': 3.91, '80S': 5.54  },
  '2-1/2': { '5S': 2.11, '10S': 3.05, '40S': 5.16, '80S': 7.01  },
  '3':     { '5S': 2.11, '10S': 3.05, '40S': 5.49, '80S': 7.62  },
  '3-1/2': { '5S': 2.11, '10S': 3.05, '40S': 5.74, '80S': 8.08  },
  '4':     { '5S': 2.11, '10S': 3.05, '40S': 6.02, '80S': 8.56  },
  '5':     { '5S': 2.77, '10S': 3.40, '40S': 6.55, '80S': 9.52  },
  '6':     { '5S': 2.77, '10S': 3.40, '40S': 7.11, '80S': 10.97 },
  '8':     { '5S': 2.77, '10S': 3.76, '40S': 8.18, '80S': 12.70 },
  '10':    { '5S': 3.40, '10S': 4.19, '40S': 9.27, '80S': 12.70 },
  '12':    { '5S': 3.96, '10S': 4.57, '40S': 9.53, '80S': 12.70 },
};

// ── DIN 11850 / EN 10357 — Tubo sanitário inox ────────────────────────────────
// Série 1 = EN 10357 Série B (alimentício / laticínios — mais comum)
// Série 2 = EN 10357 Série C (farmacêutico / pressão maior, OD alinhado ISO)
// Fonte: DIN 11850:1999 / EN 10357:2012, Tabela 1
export interface DIN11850Entry {
  od_mm: number;
  wt_mm: number; // espessura nominal da parede
}

const DIN_11850: Record<string, Record<'1' | '2', DIN11850Entry>> = {
  '10':  { '1': { od_mm: 13.0,  wt_mm: 1.5 }, '2': { od_mm: 17.2,  wt_mm: 1.5 } },
  '15':  { '1': { od_mm: 19.0,  wt_mm: 1.5 }, '2': { od_mm: 21.3,  wt_mm: 1.5 } },
  '20':  { '1': { od_mm: 23.0,  wt_mm: 1.5 }, '2': { od_mm: 26.9,  wt_mm: 1.5 } },
  '25':  { '1': { od_mm: 29.0,  wt_mm: 1.5 }, '2': { od_mm: 33.7,  wt_mm: 1.5 } },
  '32':  { '1': { od_mm: 35.0,  wt_mm: 1.5 }, '2': { od_mm: 42.4,  wt_mm: 1.5 } },
  '40':  { '1': { od_mm: 41.0,  wt_mm: 1.5 }, '2': { od_mm: 48.3,  wt_mm: 1.5 } },
  '50':  { '1': { od_mm: 53.0,  wt_mm: 1.5 }, '2': { od_mm: 60.3,  wt_mm: 1.5 } },
  '65':  { '1': { od_mm: 70.0,  wt_mm: 2.0 }, '2': { od_mm: 76.1,  wt_mm: 2.0 } },
  '80':  { '1': { od_mm: 85.0,  wt_mm: 2.0 }, '2': { od_mm: 88.9,  wt_mm: 2.0 } },
  '100': { '1': { od_mm: 104.0, wt_mm: 2.0 }, '2': { od_mm: 114.3, wt_mm: 2.0 } },
  '125': { '1': { od_mm: 129.0, wt_mm: 2.5 }, '2': { od_mm: 139.7, wt_mm: 2.5 } },
  '150': { '1': { od_mm: 154.0, wt_mm: 2.5 }, '2': { od_mm: 168.3, wt_mm: 3.0 } },
  '200': { '1': { od_mm: 204.0, wt_mm: 3.0 }, '2': { od_mm: 219.1, wt_mm: 3.0 } },
};

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface DimensaoTubulacao {
  od_mm: number;
  espessura_mm: number;
  id_mm: number;   // ID = OD − 2 × espessura_mm
  label: string;
}

// ── Helpers — ASME ────────────────────────────────────────────────────────────

/** Lista ordenada de NPS disponíveis (B36.10M / B36.19M). */
export function getNPSList(): string[] {
  return Object.keys(NPS_OD_MM);
}

/** Schedules disponíveis para uma norma + NPS. Retorna [] se NPS inválido. */
export function getSchedules(
  norma: 'ASME_B36_10M' | 'ASME_B36_19M',
  nps: string,
): string[] {
  const table = norma === 'ASME_B36_19M' ? B36_19M_WT : B36_10M_WT;
  return Object.keys(table[nps] ?? {});
}

/** Schedule padrão por norma (10S para inox, STD para carbono). */
export function getDefaultSchedule(norma: 'ASME_B36_10M' | 'ASME_B36_19M'): string {
  return norma === 'ASME_B36_19M' ? '10S' : 'STD';
}

/**
 * Retorna dimensões para ASME B36.10M ou B36.19M dado NPS + schedule.
 * Retorna null se combinação NPS/schedule não existe na norma.
 */
export function getDimensaoASME(
  norma: 'ASME_B36_10M' | 'ASME_B36_19M',
  nps: string,
  schedule: string,
): DimensaoTubulacao | null {
  const od = NPS_OD_MM[nps];
  if (od === undefined) return null;
  const table = norma === 'ASME_B36_19M' ? B36_19M_WT : B36_10M_WT;
  const t = table[nps]?.[schedule];
  if (t === undefined) return null;
  // ID = OD − 2 × t
  const id_mm = Math.round((od - 2 * t) * 100) / 100;
  return {
    od_mm: od,
    espessura_mm: t,
    id_mm,
    label: `ASME ${nps}" SCH ${schedule}`,
  };
}

// ── Helpers — DIN 11850 ───────────────────────────────────────────────────────

/** Lista ordenada de DNs disponíveis (DIN 11850). */
export function getDNList(): string[] {
  return Object.keys(DIN_11850);
}

/**
 * Retorna dimensões para DIN 11850 dado DN + série.
 * Retorna null se DN não existe na tabela.
 */
export function getDimensaoDIN11850(
  dn: string,
  serie: '1' | '2',
): DimensaoTubulacao | null {
  const entry = DIN_11850[dn]?.[serie];
  if (!entry) return null;
  const { od_mm, wt_mm } = entry;
  const id_mm = Math.round((od_mm - 2 * wt_mm) * 100) / 100;
  return {
    od_mm,
    espessura_mm: wt_mm,
    id_mm,
    label: `DIN 11850 DN${dn} Série ${serie}`,
  };
}

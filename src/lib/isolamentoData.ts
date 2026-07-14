/**
 * Constantes de referência para a Calculadora de Isolamento Térmico.
 *
 * Fonte: tabela ANSI de diâmetros externos por bitola nominal (NPS), em mm.
 */

export const BITOLAS: Record<string, number> = {
  '1/8': 10.29,
  '1/4': 13.72,
  '3/8': 17.15,
  '1/2': 21.34,
  '3/4': 26.67,
  '1': 33.4,
  '1 1/4': 42.16,
  '1 1/2': 48.26,
  '2': 60.33,
  '2 1/2': 73.03,
  '3': 88.9,
  '4': 114.3,
  '5': 141.3,
  '6': 168.28,
  '8': 219.08,
  '10': 273.05,
  '12': 323.85,
  '14': 355.6,
  '16': 406.4,
  '18': 457.2,
  '20': 508,
  '22': 558.8,
  '24': 609.6,
};

export const DENSIDADES: Record<string, number> = {
  Inox: 8000,
  'Alumínio': 2700,
  PIR: 45,
};

/** Bitolas ordenadas por diâmetro externo crescente, para uso em dropdowns. */
export const BITOLAS_ORDENADAS: string[] = Object.keys(BITOLAS).sort(
  (a, b) => BITOLAS[a] - BITOLAS[b],
);

/** Materiais de chapa disponíveis para dropdown (metálicos). */
export const MATERIAIS_CHAPA: string[] = ['Inox', 'Alumínio'];

/** Materiais de isolamento disponíveis para dropdown. */
export const MATERIAIS_ISOLAMENTO: string[] = ['PIR'];

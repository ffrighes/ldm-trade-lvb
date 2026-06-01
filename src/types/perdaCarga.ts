export type Confianca = 'alta' | 'media' | 'baixa';
export type RegiaoFluxo = 'laminar' | 'turbulento' | 'transicao';
export type TipoElemento = 'trecho' | 'curva' | 'te' | 'valvula' | 'filtro' | 'acessorio';

export interface FluidoProps {
  nome: string;
  densidade: number;    // kg/m³
  viscDinamica: number; // Pa·s (μ)
  temperatura: number;  // °C
}

interface BaseElemento {
  id: string;
  tipo: TipoElemento;
  quantidade: number;
}

export interface TrechoTubo extends BaseElemento {
  tipo: 'trecho';
  material: string;
  diametro: number;    // mm (interno) — ID derivado de norma ou entrada manual
  comprimento: number; // mm
  desnivel: number;    // mm (+ = subida)
  rugosidade: number;  // mm
  // Campos normativos opcionais (ausentes em dados legados — backward-compat)
  norma?: 'ASME_B36_10M' | 'ASME_B36_19M' | 'DIN_11850';
  nps?: string;           // ex.: "1/2", "2", "5"  (ASME)
  schedule?: string;      // ex.: "10S", "STD"      (ASME)
  dn?: string;            // ex.: "50", "100"       (DIN 11850)
  serie_din?: '1' | '2'; // série DIN 11850
  od_mm?: number;         // diâmetro externo em mm
  espessura_mm?: number;  // espessura de parede em mm
  label_normativo?: string; // ex.: "ASME 5\" SCH 10S"
}

export interface CurvaFitting extends BaseElemento {
  tipo: 'curva';
  subtipo: string;
  label: string;
  diametro: number; // mm
  k: number;
}

export interface TeFitting extends BaseElemento {
  tipo: 'te';
  subtipo: 'direta' | 'lateral';
  label: string;
  diametro: number; // mm
  k: number;
}

export interface ValvulaFitting extends BaseElemento {
  tipo: 'valvula';
  subtipo: string;
  label: string;
  diametro: number; // mm
  k: number;
}

export interface FiltroFitting extends BaseElemento {
  tipo: 'filtro';
  diametro: number; // mm
  modo: 'k_generico' | 'cv_fabricante';
  k?: number;
  cv?: number;
  cvUnidade?: 'SI' | 'US'; // SI: m³/h/bar^0.5  |  US: gpm/psi^0.5
}

export interface AcessorioFitting extends BaseElemento {
  tipo: 'acessorio';
  nome: string;
  diametro: number; // mm
  k: number;
}

export type ElementoHidraulico =
  | TrechoTubo
  | CurvaFitting
  | TeFitting
  | ValvulaFitting
  | FiltroFitting
  | AcessorioFitting;

export interface LinhaHidraulica {
  id: string;
  nome: string;
  vazao: number; // m³/h
  elementos: ElementoHidraulico[];
}

export interface CircuitoHidraulico {
  fluido: FluidoProps;
  linhas: LinhaHidraulica[];
}

export interface ResultadoElemento {
  elementoId: string;
  velocidade: number | null;     // m/s
  reynolds: number | null;
  fatorAtrito: number | null;    // só trechos
  regiao: RegiaoFluxo | null;    // só trechos
  dpBar: number | null;          // bar
  dpMca: number | null;          // m.c.a.
  contribuicaoPct: number | null;
  aviso?: string;
  erro?: string;
}

export interface ResultadoLinha {
  linhaId: string;
  dpTotalBar: number;
  dpTotalMca: number;
  velocidadeMax: number;
  bloqueada: boolean;
  elementos: ResultadoElemento[];
  avisos: string[];
}

export interface ResultadoCircuito {
  dpTotalBar: number;
  dpTotalMca: number;
  linhas: ResultadoLinha[];
}

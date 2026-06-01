export type Confianca = 'alta' | 'media' | 'baixa';
export type RegiaoFluxo = 'laminar' | 'turbulento' | 'transicao';
export type TipoElemento = 'trecho' | 'curva' | 'te' | 'valvula' | 'filtro' | 'acessorio' | 'reducao';

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

// Campos normativos opcionais — compartilhados por todos os tipos de elemento.
// Ausentes em dados legados (backward-compat).
export interface CamposNormativos {
  norma?: 'ASME_B36_10M' | 'ASME_B36_19M' | 'DIN_11850';
  nps?: string;            // ex.: "1/2", "2", "5"  (ASME)
  schedule?: string;       // ex.: "10S", "STD"      (ASME)
  dn?: string;             // ex.: "50", "100"       (DIN 11850)
  serie_din?: '1' | '2';  // série DIN 11850
  od_mm?: number;          // diâmetro externo em mm
  espessura_mm?: number;   // espessura de parede em mm
  label_normativo?: string; // ex.: "ASME 5\" SCH 10S"
}

export interface TrechoTubo extends BaseElemento, CamposNormativos {
  tipo: 'trecho';
  material: string;
  diametro: number;    // mm (interno) — ID derivado de norma ou entrada manual
  comprimento: number; // mm
  desnivel: number;    // mm (+ = subida)
  rugosidade: number;  // mm
}

export interface CurvaFitting extends BaseElemento, CamposNormativos {
  tipo: 'curva';
  subtipo: string;
  label: string;
  diametro: number; // mm (ID)
  k: number;        // K efetivo (pode ser nCrane × fT quando NPS definido)
}

export interface TeFitting extends BaseElemento, CamposNormativos {
  tipo: 'te';
  subtipo: 'direta' | 'lateral';
  label: string;
  diametro: number; // mm (ID)
  k: number;
}

export interface ValvulaFitting extends BaseElemento, CamposNormativos {
  tipo: 'valvula';
  subtipo: string;
  label: string;
  diametro: number; // mm (ID)
  k: number;
}

export interface FiltroFitting extends BaseElemento, CamposNormativos {
  tipo: 'filtro';
  diametro: number; // mm (ID)
  modo: 'k_generico' | 'cv_fabricante';
  k?: number;
  cv?: number;
  cvUnidade?: 'SI' | 'US'; // SI: m³/h/bar^0.5  |  US: gpm/psi^0.5
}

export interface AcessorioFitting extends BaseElemento, CamposNormativos {
  tipo: 'acessorio';
  nome: string;
  diametro: number; // mm (ID)
  k: number;
}

/** Redução abrupta (contração ou expansão). Dois diâmetros por norma. */
export interface ReducaoFitting extends BaseElemento {
  tipo: 'reducao';
  // Seção de entrada
  diametro_entrada: number;        // mm (ID)
  norma_entrada?: 'ASME_B36_10M' | 'ASME_B36_19M' | 'DIN_11850';
  nps_entrada?: string;
  schedule_entrada?: string;
  dn_entrada?: string;
  serie_din_entrada?: '1' | '2';
  od_entrada?: number;
  esp_entrada?: number;
  label_entrada?: string;
  // Seção de saída
  diametro_saida: number;          // mm (ID)
  norma_saida?: 'ASME_B36_10M' | 'ASME_B36_19M' | 'DIN_11850';
  nps_saida?: string;
  schedule_saida?: string;
  dn_saida?: string;
  serie_din_saida?: '1' | '2';
  od_saida?: number;
  esp_saida?: number;
  label_saida?: string;
}

export type ElementoHidraulico =
  | TrechoTubo
  | CurvaFitting
  | TeFitting
  | ValvulaFitting
  | FiltroFitting
  | AcessorioFitting
  | ReducaoFitting;

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

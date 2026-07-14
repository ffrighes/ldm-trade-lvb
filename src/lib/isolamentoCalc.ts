/**
 * Cálculo da Calculadora de Isolamento Térmico — funções puras, sem UI/Supabase.
 */

import { BITOLAS, DENSIDADES } from './isolamentoData';

export interface LinhaIsolamentoInput {
  bitola: string;
  comprimentoM: number;
  espessuraIsolMm: number;
  materialChapa: string;
  espessuraChapaMm: number;
  materialIsol: string;
}

export interface LinhaIsolamentoResult {
  diametroTuboMm: number | null;
  diametroIsolMm: number | null;
  volumeIsolM3: number;
  perimetroMm: number;
  areaChapaM2: number;
  pesoChapaKg: number;
  pesoIsolKg: number;
  erro?: string;
}

function resultadoComErro(erro: string): LinhaIsolamentoResult {
  return {
    diametroTuboMm: null,
    diametroIsolMm: null,
    volumeIsolM3: 0,
    perimetroMm: 0,
    areaChapaM2: 0,
    pesoChapaKg: 0,
    pesoIsolKg: 0,
    erro,
  };
}

/** Calcula os resultados de uma linha de isolamento térmico. */
export function calcularLinha(input: LinhaIsolamentoInput): LinhaIsolamentoResult {
  const diametroTuboMm = BITOLAS[input.bitola];
  if (diametroTuboMm === undefined) {
    return resultadoComErro('Bitola não encontrada');
  }

  const densidadeChapa = DENSIDADES[input.materialChapa];
  if (densidadeChapa === undefined) {
    return resultadoComErro(`Material de chapa não encontrado: ${input.materialChapa}`);
  }

  const densidadeIsol = DENSIDADES[input.materialIsol];
  if (densidadeIsol === undefined) {
    return resultadoComErro(`Material de isolamento não encontrado: ${input.materialIsol}`);
  }

  const diametroIsolMm = diametroTuboMm + 2 * input.espessuraIsolMm;
  const volumeIsolM3 =
    (Math.PI * (diametroIsolMm / 2000) ** 2 - Math.PI * (diametroTuboMm / 2000) ** 2) *
    input.comprimentoM;
  const perimetroMm = diametroIsolMm * Math.PI;
  const areaChapaM2 = (perimetroMm * input.comprimentoM) / 1000;
  const pesoChapaKg = (input.espessuraChapaMm / 1000) * areaChapaM2 * densidadeChapa;
  const pesoIsolKg = volumeIsolM3 * densidadeIsol;

  return {
    diametroTuboMm,
    diametroIsolMm,
    volumeIsolM3,
    perimetroMm,
    areaChapaM2,
    pesoChapaKg,
    pesoIsolKg,
  };
}

export interface TotaisIsolamento {
  totalChapaKg: number;
  totalIsolKg: number;
}

/** Soma os totais de um conjunto de linhas, ignorando linhas com erro. */
export function calcularTotais(linhas: LinhaIsolamentoResult[]): TotaisIsolamento {
  return linhas.reduce<TotaisIsolamento>(
    (acc, linha) => {
      if (linha.erro) return acc;
      acc.totalChapaKg += linha.pesoChapaKg;
      acc.totalIsolKg += linha.pesoIsolKg;
      return acc;
    },
    { totalChapaKg: 0, totalIsolKg: 0 },
  );
}

export type RegimeTributario = 'lucro_real' | 'lucro_presumido' | 'simples_nacional';

export interface ItemCotacaoCalc {
  valor_unitario: number;
  desconto_pct: number;
  ipi_pct: number;
  icms_pct: number;
  pis_pct: number;
  cofins_pct: number;
}

export interface CalcResult {
  base_liquida: number;
  ipi_valor: number;
  icms_valor: number;
  pis_valor: number;
  cofins_valor: number;
  preco_final_unit: number;
}

/**
 * Calcula o preço final unitário em BRL/unidade.
 *
 * Fórmula geral:
 *   base_liquida = valor_unitario × (1 − desconto_pct/100)
 *   ipi_valor    = base_liquida × (ipi_pct/100)
 *
 * Regime "lucro_real" e "lucro_presumido":
 *   preco_final_unit = base_liquida + ipi_valor
 *   (ICMS/PIS/COFINS são informativos — recuperáveis como crédito)
 *
 * Regime "simples_nacional":
 *   preco_final_unit = base_liquida + ipi_valor + icms_valor + pis_valor + cofins_valor
 *   (sem crédito; tudo entra no custo)
 *
 * Unidades:
 *   valor_unitario, preco_final_unit: R$/unidade (BRL)
 *   percentuais: 0..100
 */
export function calcPrecoFinal(
  cotacao: ItemCotacaoCalc,
  regime: RegimeTributario,
): CalcResult {
  const base_liquida = cotacao.valor_unitario * (1 - cotacao.desconto_pct / 100);
  const ipi_valor    = base_liquida * (cotacao.ipi_pct / 100);
  const icms_valor   = base_liquida * (cotacao.icms_pct / 100);
  const pis_valor    = base_liquida * (cotacao.pis_pct / 100);
  const cofins_valor = base_liquida * (cotacao.cofins_pct / 100);

  const preco_final_unit =
    regime === 'simples_nacional'
      ? base_liquida + ipi_valor + icms_valor + pis_valor + cofins_valor
      : base_liquida + ipi_valor;

  return { base_liquida, ipi_valor, icms_valor, pis_valor, cofins_valor, preco_final_unit };
}

export function calcTotalItem(
  cotacao: ItemCotacaoCalc,
  regime: RegimeTributario,
  quantidade: number,
): number {
  return calcPrecoFinal(cotacao, regime).preco_final_unit * quantidade;
}

/** Retorna o índice do fornecedor com o menor total (ignorando sem_cotacao_vigente). */
export function bestPriceIndex(totais: number[], semCotacao: boolean[]): number | null {
  let best: number | null = null;
  for (let i = 0; i < totais.length; i++) {
    if (semCotacao[i]) continue;
    if (best === null || totais[i] < totais[best]) best = i;
  }
  return best;
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatPct(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

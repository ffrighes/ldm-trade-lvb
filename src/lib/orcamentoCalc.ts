/**
 * Cálculo de impostos de orçamentos — fonte única da fórmula (reusada na UI e
 * em qualquer export). Mantém a mesma premissa da coluna gerada no banco
 * (orcamento_itens.preco_unit_liquido).
 *
 * PREMISSA "POR DENTRO" (impostos embutidos no preço com impostos):
 *   t        = (icms_pct + pis_cofins_pct + ipi_pct) / 100   // fração total de imposto
 *   p_li     = p_ci * (1 - t)                                 // preço líquido unitário
 *   imp_un   = p_ci - p_li                                    // imposto unitário = p_ci * t
 *   total_ci = qtd * p_ci                                     // total com impostos
 *   total_li = qtd * p_li                                     // total líquido
 *
 * Esta é a leitura direta de "valor com impostos -> líquido". Difere da mecânica
 * estrita de NF-e brasileira, onde o IPI costuma ser "por fora" (somado sobre o
 * valor do produto) e a base do ICMS inclui o próprio ICMS. Para alternar para a
 * convenção "por fora", trocar a linha de p_li por: p_ci / (1 + t).
 */

export interface OrcamentoLinhaInput {
  /** Quantidade da linha. */
  quantidade: number;
  /** Preço unitário COM impostos (R$). */
  precoUnitComImpostos: number;
  /** Percentual de ICMS (0–100). */
  icmsPct: number;
  /** Percentual de PIS/COFINS combinado (0–100). */
  pisCofinsPct: number;
  /** Percentual de IPI (0–100). */
  ipiPct: number;
}

export interface OrcamentoLinhaResultado {
  /** Fração total de imposto (0–1). */
  fracaoImposto: number;
  /** Preço líquido unitário (R$). */
  precoUnitLiquido: number;
  /** Imposto unitário (R$). */
  impostoUnit: number;
  /** Total da linha COM impostos (R$). */
  totalComImpostos: number;
  /** Total líquido da linha (R$). */
  totalLiquido: number;
  /** Total de impostos da linha (R$). */
  totalImpostos: number;
  /**
   * true quando a soma dos percentuais excede 100% (líquido ficaria negativo).
   * A UI deve avisar; o valor não é clampado para preservar o que o usuário digitou.
   */
  excedeImpostos: boolean;
}

/** Calcula os valores derivados de uma linha de orçamento (modelo "por dentro"). */
export function calcOrcamentoLinha(input: OrcamentoLinhaInput): OrcamentoLinhaResultado {
  const qtd = Number.isFinite(input.quantidade) ? input.quantidade : 0;
  const pCi = Number.isFinite(input.precoUnitComImpostos) ? input.precoUnitComImpostos : 0;
  const somaPct =
    (Number(input.icmsPct) || 0) +
    (Number(input.pisCofinsPct) || 0) +
    (Number(input.ipiPct) || 0);

  const t = somaPct / 100; // fração total de imposto
  const precoUnitLiquido = pCi * (1 - t); // p_li = p_ci * (1 - t)
  const impostoUnit = pCi - precoUnitLiquido; // imp_un = p_ci * t
  const totalComImpostos = qtd * pCi; // total_ci
  const totalLiquido = qtd * precoUnitLiquido; // total_li
  const totalImpostos = totalComImpostos - totalLiquido;

  return {
    fracaoImposto: t,
    precoUnitLiquido,
    impostoUnit,
    totalComImpostos,
    totalLiquido,
    totalImpostos,
    excedeImpostos: somaPct > 100,
  };
}

export interface OrcamentoTotais {
  totalLiquido: number;
  totalComImpostos: number;
  totalImpostos: number;
}

/** Soma os totais de um conjunto de linhas de orçamento. */
export function calcOrcamentoTotais(linhas: OrcamentoLinhaInput[]): OrcamentoTotais {
  return linhas.reduce<OrcamentoTotais>(
    (acc, linha) => {
      const r = calcOrcamentoLinha(linha);
      acc.totalLiquido += r.totalLiquido;
      acc.totalComImpostos += r.totalComImpostos;
      acc.totalImpostos += r.totalImpostos;
      return acc;
    },
    { totalLiquido: 0, totalComImpostos: 0, totalImpostos: 0 },
  );
}

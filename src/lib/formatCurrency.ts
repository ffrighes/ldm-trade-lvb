export function formatBRL(value: number, decimals = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formata um número para exibição num input de custo (sem símbolo de moeda),
 * com 2 casas decimais no mínimo e até 4 quando o valor exigir precisão maior
 * (custos podem ter até 4 casas decimais e não devem ser truncados).
 */
export function formatCustoInput(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export function parseBRL(value: string): number {
  return parseBRLInput(value) ?? 0;
}

/**
 * Converte uma entrada de custo em formato livre para número, aceitando:
 * - `1.234,5678` (pt-BR com separador de milhar)
 * - `1234,56` (pt-BR sem separador de milhar)
 * - `1234.5678` (decimal com ponto)
 * - `R$ 545,75` (com prefixo de moeda)
 * Retorna `null` para entradas vazias, inválidas ou negativas.
 */
export function parseBRLInput(raw: string): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const stripped = trimmed.replace(/^R\$\s*/i, '').replace(/\s+/g, '');
  if (stripped === '') return null;

  let normalized: string;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(stripped)) {
    // Formato pt-BR com separador de milhar: 1.234 ou 1.234,56
    normalized = stripped.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+,\d+$/.test(stripped)) {
    // Formato pt-BR simples: 1234,56
    normalized = stripped.replace(',', '.');
  } else if (/^\d+(\.\d+)?$/.test(stripped)) {
    // Número puro / decimal com ponto: 1234.56 ou 1234
    normalized = stripped;
  } else {
    return null;
  }

  const num = parseFloat(normalized);
  if (!isFinite(num) || num < 0) return null;
  return num;
}

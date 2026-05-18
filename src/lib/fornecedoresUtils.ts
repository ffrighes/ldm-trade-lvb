export interface PrecoComData {
  id: string;
  material_id: string;
  data_cotacao: string;
  created_at: string;
  [key: string]: unknown;
}

export function getVigentes<T extends PrecoComData>(precos: T[]): T[] {
  const map = new Map<string, T>();
  for (const p of precos) {
    const existing = map.get(p.material_id);
    if (!existing) {
      map.set(p.material_id, p);
      continue;
    }
    if (
      p.data_cotacao > existing.data_cotacao ||
      (p.data_cotacao === existing.data_cotacao && p.created_at > existing.created_at)
    ) {
      map.set(p.material_id, p);
    }
  }
  return [...map.values()];
}

export function formatCotacao(value: number, moeda: string): string {
  const currency = moeda === 'BRL' ? 'BRL' : moeda === 'USD' ? 'USD' : 'EUR';
  const locale = moeda === 'BRL' ? 'pt-BR' : 'en-US';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

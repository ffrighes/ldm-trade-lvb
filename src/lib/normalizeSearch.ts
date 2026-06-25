// Remove diacríticos (NFD decompõe á→a + acento combinante, ç→c + cedilha
// combinante, ã→a + til combinante; os marcadores combinantes ficam no
// intervalo U+0300–U+036F e são removidos). Cobre o português completo
// (á à â ã ç é ê í ó ô õ ú ü) e a maior parte do latim (ñ→n, ü→u).
export function foldDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Forma canônica para COMPARAÇÃO de busca: sem acento + minúsculas.
// Use apenas como chave de comparação — nunca para o texto exibido ao usuário.
export function normalizeForSearch(s: string): string {
  return foldDiacritics(s).toLowerCase();
}

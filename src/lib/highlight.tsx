import { type ReactNode } from 'react';
import { foldDiacritics } from './normalizeSearch';

// Dobra `text` caractere a caractere e guarda, para cada posição do texto
// dobrado, o índice correspondente no texto ORIGINAL. Necessário porque a
// dobra pode alterar o comprimento (ex.: um caractere acentuado pode virar
// vários, ou ligaduras expandirem).
function buildFoldMap(text: string): { folded: string; map: number[] } {
  let folded = '';
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const f = foldDiacritics(text[i]).toLowerCase();
    for (let j = 0; j < f.length; j++) {
      folded += f[j];
      map.push(i);
    }
  }
  return { folded, map };
}

// Envolve cada ocorrência de `term` em <mark>, casando de forma insensível a
// acentos e maiúsculas/minúsculas, mas PRESERVANDO no texto exibido os acentos
// originais (a chave de busca é dobrada; o que aparece na tela não é).
// Retorna a string original quando o termo é vazio ou não encontrado.
// Limitação conhecida e aceitável: caracteres fora do BMP (emoji/surrogate
// pairs) não são tratados — os campos de busca são texto simples.
export function highlightMatch(text: string, term: string): ReactNode {
  const needle = foldDiacritics(term).toLowerCase().trim();
  if (!needle) return text;

  const { folded, map } = buildFoldMap(text);
  const nodes: ReactNode[] = [];
  let cursor = 0; // índice no texto ORIGINAL
  let from = 0; // início da busca no texto folded

  for (let hit = folded.indexOf(needle, from); hit !== -1; hit = folded.indexOf(needle, from)) {
    const origStart = map[hit];
    const origEnd = map[hit + needle.length - 1] + 1; // exclusivo
    if (origStart > cursor) nodes.push(text.slice(cursor, origStart));
    nodes.push(
      <mark key={origStart} className="bg-yellow-200 text-foreground rounded px-0.5">
        {text.slice(origStart, origEnd)}
      </mark>,
    );
    cursor = origEnd;
    from = hit + needle.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes.length ? <>{nodes}</> : text;
}

import { describe, expect, it } from 'vitest';
import { normalizeForSearch } from '@/lib/normalizeSearch';

// Mirrors the matchesSearch predicate used in BomTreeView for CONJUNTO nodes
// (name field) and ITEM nodes (descricao + bitola combined field).
function matchesNode(
  { name, descricao, bitola }: { name?: string; descricao?: string; bitola?: string },
  term: string,
): boolean {
  const q = normalizeForSearch(term);
  if (!q) return true;
  if (name && normalizeForSearch(name).includes(q)) return true;
  if (descricao || bitola) {
    const combined = `${descricao ?? ''} ${bitola ?? ''}`;
    if (normalizeForSearch(combined).includes(q)) return true;
  }
  return false;
}

describe('BomTree node search — accent-insensitive', () => {
  describe('CONJUNTO name search', () => {
    it('finds accented name from unaccented term', () => {
      expect(matchesNode({ name: 'Válvula borboleta' }, 'valvula')).toBe(true);
      expect(matchesNode({ name: 'Borboleta 2"' }, 'borboleta')).toBe(true);
      expect(matchesNode({ name: 'Conexão flangeada' }, 'conexao')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(matchesNode({ name: 'VÁLVULA' }, 'válvula')).toBe(true);
      expect(matchesNode({ name: 'válvula' }, 'VALVULA')).toBe(true);
    });

    it('rejects non-matching terms', () => {
      expect(matchesNode({ name: 'Válvula' }, 'tubo')).toBe(false);
    });
  });

  describe('ITEM material search (descricao + bitola)', () => {
    it('finds accented descricao from unaccented term', () => {
      expect(matchesNode({ descricao: 'Redução concêntrica', bitola: '2" x 1"' }, 'reducao')).toBe(true);
      expect(matchesNode({ descricao: 'Válvula de esfera', bitola: '1/2"' }, 'valvula')).toBe(true);
    });

    it('finds item by bitola when descricao does not match', () => {
      expect(matchesNode({ descricao: 'Tubo sem costura', bitola: '2 1/2"' }, '2 1/2')).toBe(true);
    });

    it('finds item when term spans descricao and bitola boundary', () => {
      // term covers end of descricao + beginning of bitola via combined string
      expect(matchesNode({ descricao: 'Inox 304', bitola: 'DN50' }, 'inox 304')).toBe(true);
    });

    it('empty term matches everything', () => {
      expect(matchesNode({ descricao: 'Qualquer coisa' }, '')).toBe(true);
      expect(matchesNode({ name: 'Qualquer coisa' }, '')).toBe(true);
    });
  });
});

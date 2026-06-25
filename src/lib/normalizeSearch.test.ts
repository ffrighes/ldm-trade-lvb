import { describe, expect, it } from 'vitest';
import { foldDiacritics, normalizeForSearch } from './normalizeSearch';

describe('foldDiacritics', () => {
  it('removes Portuguese diacritics, preserving case', () => {
    expect(foldDiacritics('Válvula')).toBe('Valvula');
    expect(foldDiacritics('Redução')).toBe('Reducao');
    expect(foldDiacritics('Conexão')).toBe('Conexao');
    expect(foldDiacritics('Inóx 304')).toBe('Inox 304');
  });

  it('folds cedilla, tilde-n and umlaut', () => {
    expect(foldDiacritics('ç')).toBe('c');
    expect(foldDiacritics('niño')).toBe('nino');
    expect(foldDiacritics('über')).toBe('uber');
  });

  it('covers the full Portuguese vowel set', () => {
    expect(foldDiacritics('á à â ã é ê í ó ô õ ú ü')).toBe('a a a a e e i o o o u u');
  });

  it('leaves plain ASCII unchanged', () => {
    expect(foldDiacritics('valve 1/2 inox 304')).toBe('valve 1/2 inox 304');
  });
});

describe('normalizeForSearch', () => {
  it('folds diacritics and lowercases', () => {
    expect(normalizeForSearch('CONEXÃO')).toBe('conexao');
    expect(normalizeForSearch('Válvula')).toBe('valvula');
    expect(normalizeForSearch('Redução')).toBe('reducao');
  });

  it('is a no-op (other than case) for plain ASCII', () => {
    expect(normalizeForSearch('Inox 304')).toBe('inox 304');
  });
});

// Mirrors the predicate used by the in-memory list filters
// (BaseDadosPage, ProjectsPage, BomTreeView, CatalogPickerDialog):
// both the field and the term are folded before `includes`.
describe('accent-insensitive filter predicate', () => {
  const matches = (field: string, term: string) =>
    normalizeForSearch(field).includes(normalizeForSearch(term));

  it('finds accented entries from an unaccented term', () => {
    expect(matches('Válvula de esfera', 'valvula')).toBe(true);
    expect(matches('Redução concêntrica', 'reducao')).toBe(true);
    expect(matches('Conexão flangeada', 'conexao')).toBe(true);
    expect(matches('Tubo Inóx 304', 'inox 304')).toBe(true);
  });

  it('still finds entries when the term itself carries accents', () => {
    expect(matches('Valvula gaveta', 'válvula')).toBe(true);
    expect(matches('Válvula gaveta', 'válvula')).toBe(true);
  });

  it('keeps plain ASCII matching working and rejects non-matches', () => {
    expect(matches('Inox 304', 'inox')).toBe(true);
    expect(matches('Válvula', 'tubo')).toBe(false);
  });
});

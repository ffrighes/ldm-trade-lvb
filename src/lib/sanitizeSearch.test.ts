import { describe, expect, it } from 'vitest';
import { SEARCH_MAX_LENGTH, isValidSearch, sanitizeSearch } from './sanitizeSearch';

describe('sanitizeSearch', () => {
  it('strips PostgREST or-filter separators and ilike wildcards', () => {
    expect(sanitizeSearch('a,b(c)d*e%f_g\\h')).toBe('a b c d e f g h');
  });

  it('collapses repeated whitespace', () => {
    expect(sanitizeSearch('foo    bar')).toBe('foo bar');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeSearch('  foo  ')).toBe('foo');
  });

  it('caps length at SEARCH_MAX_LENGTH', () => {
    const long = 'a'.repeat(SEARCH_MAX_LENGTH + 50);
    expect(sanitizeSearch(long).length).toBe(SEARCH_MAX_LENGTH);
  });

  it('preserves unicode safely', () => {
    expect(sanitizeSearch('café ção 🚀')).toBe('café ção 🚀');
  });

  it('neutralizes typical injection-shaped strings', () => {
    expect(sanitizeSearch("'; drop table x; --")).toBe("'; drop table x; --");
    expect(sanitizeSearch('<script>alert(1)</script>')).toBe('<script>alert 1 </script>');
  });
});

describe('isValidSearch', () => {
  it('rejects empty/short input', () => {
    expect(isValidSearch('')).toBe(false);
    expect(isValidSearch(' ')).toBe(false);
    expect(isValidSearch('a')).toBe(false);
  });

  it('accepts >=2 chars', () => {
    expect(isValidSearch('ab')).toBe(true);
    expect(isValidSearch('hello')).toBe(true);
  });

  it('rejects >100 chars', () => {
    expect(isValidSearch('a'.repeat(101))).toBe(false);
  });
});

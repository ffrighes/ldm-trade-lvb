import { describe, it, expect } from 'vitest';
import { formatBRL, formatCustoInput, parseBRL, parseBRLInput } from './formatCurrency';

// Intl.NumberFormat('pt-BR', { style: 'currency' }) may separate the symbol
// with a non-breaking space instead of a regular space; normalize before comparing.
const normalizeSpaces = (s: string) => s.replace(/\s/g, ' ');

describe('formatBRL', () => {
  it('formats with 2 decimals by default', () => {
    expect(normalizeSpaces(formatBRL(1234.5))).toBe('R$ 1.234,50');
  });

  it('formats with a custom number of decimals', () => {
    expect(normalizeSpaces(formatBRL(545.7533, 4))).toBe('R$ 545,7533');
  });
});

describe('formatCustoInput', () => {
  it('preserves up to 4 decimals without truncating', () => {
    expect(formatCustoInput(545.7533)).toBe('545,7533');
  });

  it('pads whole numbers to 2 decimals', () => {
    expect(formatCustoInput(250)).toBe('250,00');
  });

  it('applies thousands grouping', () => {
    expect(formatCustoInput(1234.5)).toBe('1.234,50');
  });
});

describe('parseBRLInput', () => {
  it('parses pt-BR with thousands separator and 4 decimals', () => {
    expect(parseBRLInput('1.234,5678')).toBe(1234.5678);
  });

  it('parses plain decimal with dot', () => {
    expect(parseBRLInput('1234.56')).toBe(1234.56);
  });

  it('parses currency-prefixed pt-BR input', () => {
    expect(parseBRLInput('R$ 1234,56')).toBe(1234.56);
  });

  it('parses pt-BR without thousands separator', () => {
    expect(parseBRLInput('545,7533')).toBe(545.7533);
  });

  it('parses a raw 4-decimal value without losing precision', () => {
    expect(parseBRLInput('545.7533')).toBe(545.7533);
  });

  it('returns null for empty input', () => {
    expect(parseBRLInput('')).toBeNull();
    expect(parseBRLInput('   ')).toBeNull();
  });

  it('returns null for invalid text', () => {
    expect(parseBRLInput('abc')).toBeNull();
    expect(parseBRLInput('12,34,56')).toBeNull();
  });

  it('returns null for negative values', () => {
    expect(parseBRLInput('-10')).toBeNull();
  });
});

describe('parseBRL', () => {
  it('returns 0 for invalid input instead of throwing', () => {
    expect(parseBRL('not a number')).toBe(0);
    expect(parseBRL('')).toBe(0);
  });

  it('parses a valid pt-BR value', () => {
    expect(parseBRL('1.234,56')).toBe(1234.56);
  });
});

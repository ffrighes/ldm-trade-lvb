import { describe, expect, it } from 'vitest';
import { longestCommonPrefix, significantCommonPrefix, extractSuffix } from './commonPrefix';

describe('longestCommonPrefix', () => {
  it('returns empty string for empty array', () => {
    expect(longestCommonPrefix([])).toBe('');
  });

  it('returns empty string for single-item array', () => {
    expect(longestCommonPrefix(['Kit Estojos'])).toBe('');
  });

  it('returns full string when all items are identical', () => {
    expect(longestCommonPrefix(['abc', 'abc', 'abc'])).toBe('abc');
  });

  it('finds common prefix among real-world kit descriptions', () => {
    const names = [
      'Kit Estojos p/ Flange ASME B16.5 150LBS AISI 304 + Válvula WF - 2"',
      'Kit Estojos p/ Flange ASME B16.5 150LBS AISI 304 + Válvula WF - 3"',
      'Kit Estojos p/ Flange ASME B16.5 150LBS AISI 304 + Válvula WF - 4"',
    ];
    expect(longestCommonPrefix(names)).toBe(
      'Kit Estojos p/ Flange ASME B16.5 150LBS AISI 304 + Válvula WF - ',
    );
  });

  it('returns empty string when there is no common prefix', () => {
    expect(longestCommonPrefix(['abc', 'xyz', 'def'])).toBe('');
  });

  it('handles partial prefix correctly', () => {
    expect(longestCommonPrefix(['Hello World', 'Hello There', 'Hello!'])).toBe('Hello');
  });

  it('handles strings where one is a prefix of another', () => {
    expect(longestCommonPrefix(['Kit Flange', 'Kit Flange 150LBS', 'Kit Flange 300LBS'])).toBe('Kit Flange');
  });
});

describe('significantCommonPrefix', () => {
  it('returns empty string for heterogeneous list (no common prefix)', () => {
    expect(significantCommonPrefix(['Válvula Gate 2"', 'Flange ASME 3"'])).toBe('');
  });

  it('returns empty string when raw prefix is shorter than minLength', () => {
    expect(significantCommonPrefix(['Kit 2"', 'Kit 3"'], 10)).toBe('');
  });

  it('trims trailing separators from the prefix', () => {
    const names = [
      'Kit Estojos p/ Flange ASME B16.5 150LBS - 2"',
      'Kit Estojos p/ Flange ASME B16.5 150LBS - 3"',
    ];
    expect(significantCommonPrefix(names)).toBe('Kit Estojos p/ Flange ASME B16.5 150LBS');
  });

  it('respects custom minLength threshold', () => {
    const names = ['Kit Estojos - 2"', 'Kit Estojos - 3"'];
    expect(significantCommonPrefix(names, 5)).toBe('Kit Estojos');
    expect(significantCommonPrefix(names, 20)).toBe('');
  });

  it('returns empty string for empty or single-item arrays', () => {
    expect(significantCommonPrefix([])).toBe('');
    expect(significantCommonPrefix(['Kit Estojos p/ Flange ASME B16.5'])).toBe('');
  });
});

describe('extractSuffix', () => {
  it('extracts suffix after known prefix', () => {
    expect(extractSuffix('Kit Estojos p/ Flange - 2"', 'Kit Estojos p/ Flange')).toBe('2"');
  });

  it('falls back to full string when prefix does not match', () => {
    expect(extractSuffix('Válvula Gate 2"', 'Kit Estojos')).toBe('Válvula Gate 2"');
  });

  it('handles empty prefix by returning the full string', () => {
    expect(extractSuffix('Kit Estojos 2"', '')).toBe('Kit Estojos 2"');
  });

  it('trims leading separators from the suffix', () => {
    expect(extractSuffix('Kit Estojos - 3"', 'Kit Estojos')).toBe('3"');
    expect(extractSuffix('Kit Estojos / 3"', 'Kit Estojos')).toBe('3"');
  });
});

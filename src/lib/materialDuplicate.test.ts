import { describe, it, expect } from 'vitest';
import { findDuplicateMaterial } from './materialDuplicate';

const materials = [
  { id: '1', descricao: 'Tubo ASTM A106', bitola: '2"' },
  { id: '2', descricao: 'Tubo ASTM A106', bitola: '3"' },
  { id: '3', descricao: 'Flange', bitola: '2"' },
];

describe('findDuplicateMaterial', () => {
  it('finds a match on the same familia + bitola', () => {
    const dup = findDuplicateMaterial(materials, 'Tubo ASTM A106', '2"', null);
    expect(dup?.id).toBe('1');
  });

  it('is case-insensitive and trims whitespace', () => {
    const dup = findDuplicateMaterial(materials, '  tubo astm a106  ', ' 2" ', null);
    expect(dup?.id).toBe('1');
  });

  it('returns null when no match exists', () => {
    expect(findDuplicateMaterial(materials, 'Tubo ASTM A106', '4"', null)).toBeNull();
  });

  it('ignores the record being edited', () => {
    expect(findDuplicateMaterial(materials, 'Tubo ASTM A106', '2"', '1')).toBeNull();
  });

  it('returns null when descricao or bitola is empty', () => {
    expect(findDuplicateMaterial(materials, '', '2"', null)).toBeNull();
    expect(findDuplicateMaterial(materials, 'Tubo ASTM A106', '', null)).toBeNull();
  });

  it('does not confuse different families with the same bitola', () => {
    const dup = findDuplicateMaterial(materials, 'Flange', '2"', null);
    expect(dup?.id).toBe('3');
  });
});

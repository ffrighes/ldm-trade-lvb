import { describe, it, expect } from 'vitest';
import {
  reorderIds,
  minimalPositionUpdates,
  reorderPositionUpdates,
  shiftPositionUpdates,
  type PositionedItem,
} from './bomReorder';

const sib = (ids: string[]): PositionedItem[] =>
  ids.map((id, position) => ({ id, position }));

describe('reorderIds', () => {
  it('moves an item down into a later slot', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item up into an earlier slot', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('returns a copy of the original order on a no-op', () => {
    const ids = ['a', 'b', 'c'];
    expect(reorderIds(ids, 'a', 'a')).toEqual(ids);
    expect(reorderIds(ids, 'a', 'missing')).toEqual(ids);
    expect(reorderIds(ids, 'missing', 'b')).toEqual(ids);
  });
});

describe('minimalPositionUpdates', () => {
  it('returns only the entries whose index changed', () => {
    // [a,b,c,d] -> move a onto c -> [b,c,a,d]; d keeps index 3 and is omitted.
    const updates = minimalPositionUpdates(sib(['a', 'b', 'c', 'd']), ['b', 'c', 'a', 'd']);
    expect(updates).toEqual([
      { id: 'b', position: 0 },
      { id: 'c', position: 1 },
      { id: 'a', position: 2 },
    ]);
  });

  it('returns nothing when order is unchanged', () => {
    expect(minimalPositionUpdates(sib(['a', 'b', 'c']), ['a', 'b', 'c'])).toEqual([]);
  });

  it('normalises sparse/duplicate positions to dense indexes', () => {
    const sparse: PositionedItem[] = [
      { id: 'a', position: 0 },
      { id: 'b', position: 5 },
      { id: 'c', position: 9 },
    ];
    expect(minimalPositionUpdates(sparse, ['a', 'b', 'c'])).toEqual([
      { id: 'b', position: 1 },
      { id: 'c', position: 2 },
    ]);
  });
});

describe('reorderPositionUpdates', () => {
  it('produces the minimal batch for a move, never rewriting all siblings', () => {
    const updates = reorderPositionUpdates(sib(['a', 'b', 'c', 'd', 'e']), 'b', 'd');
    // [a,b,c,d,e] -> [a,c,d,b,e]; a and e are untouched.
    expect(updates).toEqual([
      { id: 'c', position: 1 },
      { id: 'd', position: 2 },
      { id: 'b', position: 3 },
    ]);
    expect(updates.map((u) => u.id)).not.toContain('a');
    expect(updates.map((u) => u.id)).not.toContain('e');
  });

  it('is empty for a no-op move', () => {
    expect(reorderPositionUpdates(sib(['a', 'b', 'c']), 'b', 'b')).toEqual([]);
  });
});

describe('shiftPositionUpdates', () => {
  it('swaps with the previous sibling when moving up', () => {
    expect(shiftPositionUpdates(sib(['a', 'b', 'c']), 'c', -1)).toEqual([
      { id: 'c', position: 1 },
      { id: 'b', position: 2 },
    ]);
  });

  it('swaps with the next sibling when moving down', () => {
    expect(shiftPositionUpdates(sib(['a', 'b', 'c']), 'a', 1)).toEqual([
      { id: 'b', position: 0 },
      { id: 'a', position: 1 },
    ]);
  });

  it('is a no-op at the boundaries', () => {
    expect(shiftPositionUpdates(sib(['a', 'b', 'c']), 'a', -1)).toEqual([]);
    expect(shiftPositionUpdates(sib(['a', 'b', 'c']), 'c', 1)).toEqual([]);
    expect(shiftPositionUpdates(sib(['a', 'b', 'c']), 'missing', 1)).toEqual([]);
  });
});

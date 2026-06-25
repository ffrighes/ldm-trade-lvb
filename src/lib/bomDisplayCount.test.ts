import { describe, it, expect } from 'vitest';
import { computeBomNodeDisplay } from './bomDisplayCount';

describe('computeBomNodeDisplay', () => {
  it('is empty when only the root CONJUNTO node exists (no children, no child roots)', () => {
    const { isEmpty, total } = computeBomNodeDisplay(1, 0);
    expect(isEmpty).toBe(true);
    expect(total).toBe(0);
  });

  it('is NOT empty when child roots exist even with no internal nodes', () => {
    // Reproduces the LM-001 bug: 1 root node + 23 child roots → must NOT be empty
    const { isEmpty, total } = computeBomNodeDisplay(1, 23);
    expect(isEmpty).toBe(false);
    expect(total).toBe(23);
  });

  it('is NOT empty when there are internal nodes but no child roots', () => {
    const { isEmpty, total } = computeBomNodeDisplay(5, 0);
    expect(isEmpty).toBe(false);
    expect(total).toBe(4);
  });

  it('sums internal nodes and child roots for the total', () => {
    // 5 bom_node rows → 4 internal; 3 child roots → total 7
    const { total } = computeBomNodeDisplay(5, 3);
    expect(total).toBe(7);
  });

  it('is NOT empty when there are only unsaved drafts open in the UI', () => {
    const { isEmpty } = computeBomNodeDisplay(1, 0, 2);
    expect(isEmpty).toBe(false);
  });

  it('treats missing nodeCount gracefully (empty version)', () => {
    const { isEmpty, total } = computeBomNodeDisplay(0, 0);
    expect(isEmpty).toBe(true);
    expect(total).toBe(0);
  });
});

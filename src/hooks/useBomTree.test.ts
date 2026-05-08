import { describe, it, expect } from 'vitest';
import { buildBomTree } from './useBomTree';
import type { BomNode } from '@/types/bom';

const mk = (p: Partial<BomNode>): BomNode => ({
  id: p.id!,
  version_id: 'v1',
  parent_id: p.parent_id ?? null,
  node_type: p.node_type!,
  material_id: p.material_id ?? null,
  name: p.name ?? null,
  quantity: p.quantity ?? null,
  position: p.position ?? 0,
  notes: null,
  cloned_from_node_id: null,
  created_at: '',
  updated_at: '',
});

describe('buildBomTree', () => {
  it('returns null for empty input', () => {
    expect(buildBomTree([])).toBeNull();
  });

  it('builds a flat ITEM tree under a CONJUNTO', () => {
    const nodes: BomNode[] = [
      mk({ id: 'r', node_type: 'CONJUNTO', name: 'Root' }),
      mk({ id: 'i1', parent_id: 'r', node_type: 'ITEM', material_id: 'm1', quantity: 2, position: 0 }),
      mk({ id: 'i2', parent_id: 'r', node_type: 'ITEM', material_id: 'm2', quantity: 3, position: 1 }),
    ];
    const tree = buildBomTree(nodes)!;
    expect(tree.id).toBe('r');
    expect(tree.children).toHaveLength(2);
    expect(tree.children.map((c) => c.id)).toEqual(['i1', 'i2']);
    expect(tree.cumulativeQuantity).toBe(1);
    expect(tree.children[0].cumulativeQuantity).toBe(2);
    expect(tree.children[1].cumulativeQuantity).toBe(3);
  });

  it('multiplies cumulative quantities through SUBCONJUNTO levels', () => {
    const nodes: BomNode[] = [
      mk({ id: 'r', node_type: 'CONJUNTO', name: 'R' }),
      mk({ id: 's', parent_id: 'r', node_type: 'SUBCONJUNTO', name: 'S', quantity: 2, position: 0 }),
      mk({ id: 'i', parent_id: 's', node_type: 'ITEM', material_id: 'm', quantity: 4, position: 0 }),
    ];
    const tree = buildBomTree(nodes)!;
    expect(tree.children[0].cumulativeQuantity).toBe(2);
    expect(tree.children[0].children[0].cumulativeQuantity).toBe(8);
  });

  it('respects sibling position order', () => {
    const nodes: BomNode[] = [
      mk({ id: 'r', node_type: 'CONJUNTO', name: 'R' }),
      mk({ id: 'b', parent_id: 'r', node_type: 'ITEM', material_id: 'mb', quantity: 1, position: 1 }),
      mk({ id: 'a', parent_id: 'r', node_type: 'ITEM', material_id: 'ma', quantity: 1, position: 0 }),
    ];
    const tree = buildBomTree(nodes)!;
    expect(tree.children.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('handles deep nesting up to 10 levels', () => {
    const nodes: BomNode[] = [mk({ id: 'n0', node_type: 'CONJUNTO', name: 'L0' })];
    for (let i = 1; i < 10; i++) {
      nodes.push(mk({
        id: `n${i}`, parent_id: `n${i - 1}`,
        node_type: 'SUBCONJUNTO', name: `L${i}`, quantity: 2, position: 0,
      }));
    }
    const tree = buildBomTree(nodes)!;
    let cur = tree;
    let depth = 1;
    while (cur.children.length > 0) { cur = cur.children[0]; depth++; }
    expect(depth).toBe(10);
    // 2^9 because the root contributes 1 and 9 subconjuntos multiply by 2
    expect(cur.cumulativeQuantity).toBe(2 ** 9);
  });
});

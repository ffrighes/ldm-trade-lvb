import { describe, it, expect } from 'vitest';
import { collectAllItems, type ExportChildData } from './exportConjuntoPdf';
import type { BomNode, BomRoot, BomTreeNode, BomVersion } from '@/types/bom';

const matMap = new Map<string, never>();

function mkNode(p: Partial<BomNode> & { id: string }): BomNode {
  return {
    version_id: 'v1',
    parent_id: null,
    node_type: 'ITEM',
    material_id: null,
    name: p.id,
    quantity: null,
    position: 0,
    notes: null,
    cloned_from_node_id: null,
    created_at: '',
    updated_at: '',
    ...p,
  };
}

function mkTree(qty: number): BomTreeNode {
  return {
    ...mkNode({ id: 'root', node_type: 'CONJUNTO' }),
    cumulativeQuantity: 1,
    children: [
      {
        ...mkNode({ id: 'item1', node_type: 'ITEM', quantity: qty }),
        cumulativeQuantity: qty,
        children: [],
      },
    ],
  };
}

function mkEmptyTree(): BomTreeNode {
  return {
    ...mkNode({ id: 'root', node_type: 'CONJUNTO' }),
    cumulativeQuantity: 1,
    children: [],
  };
}

function mkRoot(id: string): BomRoot {
  return {
    id,
    project_id: 'proj1',
    parent_id: 'parent',
    codigo: id,
    name: id,
    created_by: null,
    created_at: '',
    updated_at: '',
    cloned_from_root_id: null,
    quantity_in_parent: 1,
  };
}

const fakeVersion: BomVersion = {
  id: 'v1',
  root_id: 'r1',
  version_number: 1,
  label: null,
  status: 'RELEASED',
  notes: null,
  created_by: null,
  created_at: '',
  released_at: null,
  obsoleted_at: null,
  cloned_from_version_id: null,
};

function mkChild(quantityInParent: number, itemQty: number, children: ExportChildData[] = []): ExportChildData {
  return {
    root: { ...mkRoot('child'), quantity_in_parent: quantityInParent },
    version: fakeVersion,
    tree: mkTree(itemQty),
    breadcrumb: [],
    children,
    quantityInParent,
  };
}

describe('collectAllItems', () => {
  it('returns items from root tree with multiplier=1', () => {
    const tree = mkTree(8);
    const rows = collectAllItems(tree, matMap, []);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantidade).toBe(8);
  });

  it('multiplies child items by quantityInParent (2 × 8 = 16)', () => {
    const tree = mkEmptyTree();
    const child = mkChild(2, 8);
    const rows = collectAllItems(tree, matMap, [child]);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantidade).toBe(16);
  });

  it('accumulates two-level chain (3 × 2 × 8 = 48)', () => {
    const tree = mkEmptyTree();
    const grandchild = mkChild(2, 8);
    const child: ExportChildData = {
      root: { ...mkRoot('child'), quantity_in_parent: 3 },
      version: fakeVersion,
      tree: mkEmptyTree(),
      breadcrumb: [],
      children: [grandchild],
      quantityInParent: 3,
    };
    const rows = collectAllItems(tree, matMap, [child]);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantidade).toBe(48);
  });

  it('quantityInParent=1 does not multiply (1 × 8 = 8)', () => {
    const tree = mkEmptyTree();
    const child = mkChild(1, 8);
    const rows = collectAllItems(tree, matMap, [child]);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantidade).toBe(8);
  });

  it('combines root items and child items', () => {
    const tree = mkTree(5);
    const child = mkChild(2, 3);
    const rows = collectAllItems(tree, matMap, [child]);
    const total = rows.reduce((s, r) => s + r.quantidade, 0);
    expect(total).toBe(5 + 2 * 3);
  });
});

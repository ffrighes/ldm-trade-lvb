export type BomNodeType = 'CONJUNTO' | 'SUBCONJUNTO' | 'ITEM';
export type BomVersionStatus = 'DRAFT' | 'RELEASED' | 'OBSOLETE';

export interface BomRoot {
  id: string;
  project_id: string;
  parent_id: string | null;
  codigo: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  cloned_from_root_id: string | null;
  /** Quantidade do filho dentro de uma unidade do pai. 1 para raízes. */
  quantity_in_parent: number;
  /** Quando true, pertence ao catálogo global de templates reutilizáveis. */
  is_standard: boolean;
}

export interface BomRootUsage {
  id: string;
  parent_root_id: string;
  child_root_id: string;
  quantity: number;
  position: number;
  notes: string | null;
  created_at: string;
}

export interface BomRootTreeNode extends BomRoot {
  children: BomRootTreeNode[];
  depth: number;
}

export interface BomVersion {
  id: string;
  root_id: string;
  version_number: number;
  label: string | null;
  status: BomVersionStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  released_at: string | null;
  obsoleted_at: string | null;
  cloned_from_version_id: string | null;
}

export interface BomNode {
  id: string;
  version_id: string;
  parent_id: string | null;
  node_type: BomNodeType;
  material_id: string | null;
  name: string | null;
  quantity: number | null;
  position: number;
  notes: string | null;
  cloned_from_node_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BomTreeNode extends BomNode {
  children: BomTreeNode[];
  /** Effective accumulated quantity considering parent multipliers. */
  cumulativeQuantity: number;
}

export interface BomDiffRow {
  change: 'ADDED' | 'REMOVED' | 'QUANTITY_CHANGED';
  node_type: BomNodeType;
  material_id: string | null;
  name_a: string | null;
  name_b: string | null;
  quantity_a: number | null;
  quantity_b: number | null;
}

export const MAX_BOM_DEPTH = 10;

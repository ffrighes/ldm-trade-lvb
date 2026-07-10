/** Canonical column model shared by every category-card table in BomTreeView. */
export interface BomTableColumnDef {
  id: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
  align?: 'left' | 'right';
  resizable: boolean;
  /** Only 'descricao' — absorves remaining table width instead of a fixed px width. */
  flexible?: boolean;
}

export const BOM_TABLE_COLUMNS: BomTableColumnDef[] = [
  { id: 'index', label: '#', defaultWidth: 40, minWidth: 40, resizable: false },
  { id: 'tag', label: 'TAG', defaultWidth: 80, minWidth: 56, resizable: true },
  { id: 'descricao', label: 'Descrição', defaultWidth: 240, minWidth: 240, resizable: false, flexible: true },
  { id: 'bitola', label: 'Bitola', defaultWidth: 72, minWidth: 56, resizable: true },
  { id: 'erp', label: 'ERP', defaultWidth: 110, minWidth: 72, resizable: true },
  { id: 'fornecedor', label: 'Fornecedor', defaultWidth: 130, minWidth: 80, resizable: true },
  { id: 'qtd', label: 'Qtd', defaultWidth: 64, minWidth: 48, align: 'right', resizable: true },
  { id: 'un', label: 'Un.', defaultWidth: 56, minWidth: 40, resizable: true },
  { id: 'notas', label: 'Notas', defaultWidth: 220, minWidth: 120, resizable: true },
  { id: 'actions', label: '', defaultWidth: 110, minWidth: 110, resizable: false },
];

export const BOM_TABLE_COLUMN_MAP: ReadonlyMap<string, BomTableColumnDef> = new Map(
  BOM_TABLE_COLUMNS.map((c) => [c.id, c]),
);

export function bomColumnCssVar(id: string): string {
  return `--bom-col-${id}`;
}

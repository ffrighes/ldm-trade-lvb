import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { BomRoot, BomTreeNode, BomVersion } from '@/types/bom';
import { type ExportChildData, type ItemRow, collectItems } from '@/lib/exportConjuntoPdf';

interface MaterialLite {
  id: string;
  descricao: string;
  bitola: string;
  unidade: string;
  erp?: string | null;
  categoria?: string | null;
}

// ---- Consolidated row for XLSX ----

interface ConsolidatedRow {
  materialId: string | null;
  descricao: string;
  bitola: string;
  unidade: string;
  erp: string;
  quantidade: number;
  categoria: string | null;
  notes: string;
}

function consolidateItemsForXlsx(rows: ItemRow[]): ConsolidatedRow[] {
  const map = new Map<string, ConsolidatedRow & { notesSet: Set<string> }>();
  for (const r of rows) {
    const key = r.materialId ?? `${r.descricao}|${r.bitola}|${r.unidade}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantidade += r.quantidade;
      if (r.notes && r.notes.trim()) existing.notesSet.add(r.notes.trim());
    } else {
      const notesSet = new Set<string>();
      if (r.notes && r.notes.trim()) notesSet.add(r.notes.trim());
      map.set(key, {
        materialId: r.materialId,
        descricao: r.descricao,
        bitola: r.bitola,
        unidade: r.unidade,
        erp: r.erp,
        quantidade: r.quantidade,
        categoria: r.categoria ?? null,
        notes: '',
        notesSet,
      });
    }
  }
  for (const v of map.values()) {
    v.notes = [...v.notesSet].join('; ');
  }
  return [...map.values()];
}

// ---- Sorting ----

const CATEGORIA_ORDER = ['Tubulação', 'Conexões', 'Válvulas', 'Fixadores', 'Instrumentos'];

function categoriaKey(cat: string | null): string {
  if (!cat) return `zz_(Sem categoria)`;
  const idx = CATEGORIA_ORDER.indexOf(cat);
  return idx >= 0 ? `${String(idx).padStart(2, '0')}_${cat}` : `y_${cat}`;
}

// ---- Available categories derivation ----

const CANONICAL_CATEGORIES = ['Tubulação', 'Conexões', 'Válvulas', 'Fixadores', 'Instrumentos'];
const SEM_CATEGORIA = '(Sem categoria)';

function deriveAvailableCategories(
  tree: BomTreeNode,
  childConjuntos: ExportChildData[],
  matMap: Map<string, MaterialLite>,
): string[] {
  const found = new Set<string>();
  function walk(node: BomTreeNode) {
    if (node.node_type === 'ITEM') {
      const cat = node.material_id ? matMap.get(node.material_id)?.categoria : null;
      found.add(cat ?? SEM_CATEGORIA);
    }
    node.children.forEach(walk);
  }
  walk(tree);
  for (const child of childConjuntos) {
    walk(child.tree);
    deriveAvailableCategories(child.tree, child.children, matMap).forEach((c) => found.add(c));
  }
  const ordered: string[] = [];
  for (const c of CANONICAL_CATEGORIES) if (found.has(c)) ordered.push(c);
  const unknown = [...found]
    .filter((c) => !CANONICAL_CATEGORIES.includes(c) && c !== SEM_CATEGORIA)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  ordered.push(...unknown);
  if (found.has(SEM_CATEGORIA)) ordered.push(SEM_CATEGORIA);
  return ordered;
}

function buildCategoryRows(
  selectedCategories: Set<string> | undefined,
  availableCategories: string[],
): unknown[][] {
  const effective =
    !selectedCategories || selectedCategories.size === 0
      ? availableCategories
      : availableCategories.filter((c) => selectedCategories.has(c));
  if (effective.length === 0) return [['Categorias', '—']];
  return effective.map((cat, i) => (i === 0 ? ['Categorias', cat] : ['', cat]));
}

// ---- Child flattening for cover sheet ----

function flattenChildrenForXlsx(
  children: ExportChildData[],
  depth: number,
  selectedRootIds?: Set<string>,
): Array<{ indent: number; label: string }> {
  const out: Array<{ indent: number; label: string }> = [];
  for (const c of children) {
    if (!selectedRootIds || selectedRootIds.size === 0 || selectedRootIds.has(c.root.id)) {
      const versionLbl = `v${c.version.version_number}, ${c.version.status}`;
      out.push({
        indent: depth,
        label: `${c.root.codigo} — ${c.root.name}  (${versionLbl})`,
      });
    }
    out.push(...flattenChildrenForXlsx(c.children, depth + 1, selectedRootIds));
  }
  return out;
}

// ---- Filtered item collection ----

function collectFilteredItems(
  rootId: string,
  tree: BomTreeNode,
  matMap: Map<string, MaterialLite>,
  childRoots: ExportChildData[],
  selectedRootIds: Set<string> | undefined,
  multiplier: number = 1,
): ItemRow[] {
  const items: ItemRow[] = [];
  if (!selectedRootIds || selectedRootIds.size === 0 || selectedRootIds.has(rootId)) {
    items.push(...collectItems(tree, 1, matMap).map((r) => ({
      ...r,
      quantidade: r.quantidade * multiplier,
    })));
  }
  for (const child of childRoots) {
    const childQty = child.quantityInParent;
    items.push(
      ...collectFilteredItems(
        child.root.id,
        child.tree,
        matMap,
        child.children,
        selectedRootIds,
        multiplier * childQty,
      ),
    );
  }
  return items;
}

// ---- Sheet builders ----

interface FilterInfo {
  selectedRootIds?: Set<string>;
  selectedCategories?: Set<string>;
  isPartial?: boolean;
}

function buildCoverSheet(
  root: BomRoot,
  version: BomVersion,
  tree: BomTreeNode,
  matMap: Map<string, MaterialLite>,
  childConjuntos: ExportChildData[],
  projeto?: { numero: string; descricao: string },
  filters?: FilterInfo,
  totalRoots?: number,
  totalCategories?: number,
): XLSX.WorkSheet {
  const projetoLabel = projeto ? `${projeto.numero} - ${projeto.descricao}` : '—';
  const versionLabel = version.label
    ? `v${version.version_number} — ${version.label}`
    : `v${version.version_number}`;
  const createdAt = format(new Date(version.created_at), 'dd/MM/yyyy HH:mm');
  const releasedAt = version.released_at
    ? format(new Date(version.released_at), 'dd/MM/yyyy HH:mm')
    : '—';

  const aoa: unknown[][] = [
    ['LISTA DE MATERIAIS', ''],
    ['', ''],
    ['Lista', `${root.codigo} — ${root.name}`],
    ['Projeto', projetoLabel],
    ['Revisão', versionLabel],
    ['Status', version.status],
    ['Data de Criação', createdAt],
    ['Data de Liberação', releasedAt],
  ];

  aoa.push(...buildCategoryRows(
    filters?.selectedCategories,
    deriveAvailableCategories(tree, childConjuntos, matMap),
  ));

  if (filters?.isPartial) {
    const nRoots = filters.selectedRootIds?.size ?? 0;
    const nCats = filters.selectedCategories?.size ?? 0;
    aoa.push([
      'Filtros aplicados',
      `Conjuntos: ${nRoots} de ${totalRoots ?? '?'} | Categorias: ${nCats} de ${totalCategories ?? '?'}`,
    ]);
  }

  aoa.push(['', '']);
  aoa.push(['Conjuntos Filhos', '']);

  const flat = flattenChildrenForXlsx(childConjuntos, 0, filters?.isPartial ? filters.selectedRootIds : undefined);
  if (flat.length === 0) {
    aoa.push(['(nenhum conjunto filho)', '']);
  } else {
    for (const { indent, label } of flat) {
      aoa.push([`${'  '.repeat(indent)}${label}`, '']);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws['!cols'] = [{ wch: 22 }, { wch: 70 }];

  // Merge A1:B1 for the title
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

  // NOTE: xlsx community edition has limited cell style support (no bold/font-size).
  // Widths and merges are applied; bold formatting is omitted because it requires
  // xlsx-style or a Pro license and would silently produce corrupt output in CE.

  return ws;
}

function buildConsolidatedSheet(
  root: BomRoot,
  tree: BomTreeNode,
  matMap: Map<string, MaterialLite>,
  childConjuntos: ExportChildData[],
  filters?: FilterInfo,
): XLSX.WorkSheet {
  const rawItems = collectFilteredItems(root.id, tree, matMap, childConjuntos, filters?.isPartial ? filters.selectedRootIds : undefined);

  const categoriaFilter = filters?.isPartial ? filters.selectedCategories : undefined;
  const filteredItems = (!categoriaFilter || categoriaFilter.size === 0)
    ? rawItems
    : rawItems.filter((r) => {
        const cat = r.categoria ?? '(Sem categoria)';
        return categoriaFilter.has(cat);
      });

  if (filteredItems.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([
      ['#', 'Descrição', 'Bitola', 'Qtd', 'Un.', 'ERP', 'Notas'],
      ['Nenhum item corresponde aos filtros selecionados.', '', '', '', '', '', ''],
    ]);
    ws['!cols'] = [
      { wch: 5 }, { wch: 55 }, { wch: 14 }, { wch: 10 }, { wch: 6 }, { wch: 14 }, { wch: 40 },
    ];
    ws['!merges'] = [{ s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }];
    return ws;
  }

  const consolidated = consolidateItemsForXlsx(filteredItems);

  consolidated.sort((a, b) => {
    const catCmp = categoriaKey(a.categoria).localeCompare(
      categoriaKey(b.categoria),
      'pt-BR',
      { numeric: true, sensitivity: 'base' },
    );
    if (catCmp !== 0) return catCmp;
    const descCmp = a.descricao.localeCompare(b.descricao, 'pt-BR', {
      numeric: true,
      sensitivity: 'base',
    });
    if (descCmp !== 0) return descCmp;
    return (a.bitola || '').localeCompare(b.bitola || '', 'pt-BR', {
      numeric: true,
      sensitivity: 'base',
    });
  });

  const header = ['#', 'Descrição', 'Bitola', 'Qtd', 'Un.', 'ERP', 'Notas'];
  const body = consolidated.map((r, i) => {
    const qtyValue = Number.isInteger(r.quantidade)
      ? r.quantidade
      : Number(r.quantidade.toFixed(2));
    return [
      i + 1,
      r.descricao,
      r.bitola || '',
      qtyValue,
      r.unidade || '',
      r.erp || '',
      r.notes || '',
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);

  ws['!cols'] = [
    { wch: 5 },   // #
    { wch: 55 },  // Descrição
    { wch: 14 },  // Bitola
    { wch: 10 },  // Qtd
    { wch: 6 },   // Un.
    { wch: 14 },  // ERP
    { wch: 40 },  // Notas
  ];

  ws['!autofilter'] = { ref: `A1:G${body.length + 1}` };

  // Freeze header row
  ws['!views'] = [{ state: 'frozen', ySplit: 1 }];

  return ws;
}

// ---- Main export function ----

export function exportConjuntoXlsx(
  root: BomRoot,
  version: BomVersion,
  tree: BomTreeNode,
  matMap: Map<string, MaterialLite>,
  childConjuntos: ExportChildData[] = [],
  projeto?: { numero: string; descricao: string },
  filters?: {
    selectedRootIds?: Set<string>;
    selectedCategories?: Set<string>;
    isPartial?: boolean;
    totalAvailableCategories?: number;
  },
): void {
  const wb = XLSX.utils.book_new();

  function countAllRoots(children: ExportChildData[]): number {
    return children.reduce((acc, c) => acc + 1 + countAllRoots(c.children), 0);
  }
  const totalRoots = 1 + countAllRoots(childConjuntos);
  const totalCategories = filters?.totalAvailableCategories ?? 0;

  const coverSheet = buildCoverSheet(root, version, tree, matMap, childConjuntos, projeto, filters, totalRoots, totalCategories);
  XLSX.utils.book_append_sheet(wb, coverSheet, 'Folha de Rosto');

  const consolidatedSheet = buildConsolidatedSheet(root, tree, matMap, childConjuntos, filters);
  XLSX.utils.book_append_sheet(wb, consolidatedSheet, 'Lista Consolidada');

  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_');
  const suffix = filters?.isPartial ? '_filtrado' : '';
  const filename = `${safe(root.codigo)}_${safe(root.name)}_v${version.version_number}${suffix}.xlsx`;

  XLSX.writeFile(wb, filename);
}

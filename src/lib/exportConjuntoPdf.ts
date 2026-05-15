import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { BomRoot, BomTreeNode, BomVersion } from '@/types/bom';

export interface ExportChildData {
  root: BomRoot;
  version: BomVersion;
  tree: BomTreeNode;
  /** Labels of ancestor roots, from top-level root down to (but not including) this root. */
  breadcrumb: string[];
  /** Nested child BomRoots of this root (used for recursive consolidated lists). */
  children: ExportChildData[];
}

interface MaterialLite {
  id: string;
  descricao: string;
  bitola: string;
  unidade: string;
  erp?: string | null;
  categoria?: string | null;
}

// Cell type for autoTable body rows (plain strings or colSpan header cells)
type BodyCell =
  | string
  | {
      content: string;
      colSpan: number;
      styles: {
        fontStyle: string;
        fillColor: [number, number, number];
        textColor: number;
      };
    };

const MARGIN_LEFT = 40;
const MARGIN_RIGHT = 40;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 36;
const TOTAL_PAGES_PLACEHOLDER = '{total_pages}';

function drawHeaderFooter(doc: jsPDF, generatedAt: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageNum = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text('LDM Trade', MARGIN_LEFT, 24);
  doc.text(`Emitido em ${generatedAt}`, pageWidth - MARGIN_RIGHT, 24, { align: 'right' });
  doc.text(
    `Página ${pageNum} de ${TOTAL_PAGES_PLACEHOLDER}`,
    pageWidth / 2,
    pageHeight - 18,
    { align: 'center' },
  );
  doc.setTextColor(0);
}

function formatQty(n: number): string {
  const v = Number(n ?? 0);
  if (isNaN(v)) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

// ---- Item row types ----

export interface ItemRow {
  materialId: string | null;
  /** node.name — the TAG shown in the BOM view */
  tag: string;
  descricao: string;
  bitola: string;
  erp: string;
  unidade: string;
  quantidade: number;
  notes: string | null;
  categoria: string | null;
}

/** Collect all ITEM nodes from a subtree. baseCumulative normalises quantities (e.g. qty per subconjunto unit). */
export function collectItems(
  node: BomTreeNode,
  baseCumulative: number,
  matMap: Map<string, MaterialLite>,
): ItemRow[] {
  const items: ItemRow[] = [];
  if (node.node_type === 'ITEM') {
    const mat = node.material_id ? matMap.get(node.material_id) : undefined;
    items.push({
      materialId: node.material_id,
      tag: node.name ?? '',
      descricao: mat?.descricao ?? node.name ?? '',
      bitola: mat?.bitola ?? '',
      erp: mat?.erp ?? '',
      unidade: mat?.unidade ?? '',
      quantidade: node.cumulativeQuantity / baseCumulative,
      notes: (node.notes && node.notes.trim()) ? node.notes : (mat?.notas ?? null),
      categoria: mat?.categoria ?? null,
    });
  }
  for (const child of node.children) {
    items.push(...collectItems(child, baseCumulative, matMap));
  }
  return items;
}

/** Collect only direct ITEM children of a node (not recursive into subconjuntos). */
function collectDirectItems(
  node: BomTreeNode,
  matMap: Map<string, MaterialLite>,
): ItemRow[] {
  return node.children
    .filter((c) => c.node_type === 'ITEM')
    .map((c) => {
      const mat = c.material_id ? matMap.get(c.material_id) : undefined;
      return {
        materialId: c.material_id,
        tag: c.name ?? '',
        descricao: mat?.descricao ?? c.name ?? '',
        bitola: mat?.bitola ?? '',
        erp: mat?.erp ?? '',
        unidade: mat?.unidade ?? '',
        quantidade: c.cumulativeQuantity,
        notes: (c.notes && c.notes.trim()) ? c.notes : (mat?.notas ?? null),
        categoria: mat?.categoria ?? null,
      };
    });
}

/**
 * Collect ALL items from a BOM tree AND from all nested child BomRoots (recursively).
 * Each child BomRoot multiplies the items below it by its `quantity_in_parent`.
 */
export function collectAllItems(
  tree: BomTreeNode,
  matMap: Map<string, MaterialLite>,
  childRoots: ExportChildData[],
  multiplier: number = 1,
): ItemRow[] {
  const items = collectItems(tree, 1, matMap).map((r) => ({
    ...r,
    quantidade: r.quantidade * multiplier,
  }));
  for (const child of childRoots) {
    const childQty = child.root.quantity_in_parent ?? 1;
    items.push(...collectAllItems(child.tree, matMap, child.children, multiplier * childQty));
  }
  return items;
}

function consolidateItems(rows: ItemRow[]): ItemRow[] {
  const map = new Map<string, ItemRow>();
  for (const r of rows) {
    const key = r.materialId ?? `${r.descricao}|${r.bitola}|${r.unidade}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantidade += r.quantidade;
      if (r.notes) {
        const parts = existing.notes ? existing.notes.split(' | ') : [];
        if (!parts.includes(r.notes)) {
          existing.notes = [...parts, r.notes].join(' | ');
        }
      }
    } else {
      map.set(key, { ...r });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.descricao.localeCompare(b.descricao, 'pt-BR', { numeric: true, sensitivity: 'base' }),
  );
}

// ---- Category grouping ----

interface CategoryGroup {
  label: string | null;
  items: ItemRow[];
}

const ITEM_SORT = (a: ItemRow, b: ItemRow) =>
  a.descricao.localeCompare(b.descricao, 'pt-BR', { numeric: true, sensitivity: 'base' });

function groupByCategoria(items: ItemRow[]): CategoryGroup[] {
  const named = new Map<string, ItemRow[]>();
  const uncategorized: ItemRow[] = [];
  for (const item of items) {
    const cat = item.categoria?.trim() || '';
    if (!cat) {
      uncategorized.push(item);
    } else {
      if (!named.has(cat)) named.set(cat, []);
      named.get(cat)!.push(item);
    }
  }

  const sorted = [...named.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }))
    .map(([label, rows]) => ({ label, items: [...rows].sort(ITEM_SORT) }));

  if (uncategorized.length > 0) {
    sorted.push({ label: null, items: [...uncategorized].sort(ITEM_SORT) });
  }

  return sorted;
}

// ---- Subconjunto traversal ----

interface SubconjuntoEntry {
  node: BomTreeNode;
  breadcrumb: string[];
}

function collectAllSubconjuntos(node: BomTreeNode, breadcrumb: string[]): SubconjuntoEntry[] {
  const result: SubconjuntoEntry[] = [];
  for (const child of node.children) {
    if (child.node_type === 'SUBCONJUNTO') {
      result.push({ node: child, breadcrumb });
      result.push(...collectAllSubconjuntos(child, [...breadcrumb, child.name ?? '']));
    }
  }
  return result;
}

// ---- Table style constants ----

/** 7-column consolidated table: # | Descrição | Bitola | Qtd. | Un. | ERP | Notas */
const CONSOLIDATED_TABLE_STYLES = {
  styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' as const },
  headStyles: { fillColor: [40, 40, 40] as [number, number, number], textColor: 255 },
  rowPageBreak: 'avoid' as const,
  columnStyles: {
    0: { cellWidth: 25, overflow: 'visible' as const },
    1: { cellWidth: 'auto' as const },
    2: { cellWidth: 60, halign: 'center' as const, overflow: 'visible' as const },
    3: { cellWidth: 50, halign: 'center' as const, overflow: 'visible' as const },
    4: { cellWidth: 40, halign: 'center' as const, overflow: 'visible' as const },
    5: { cellWidth: 90, halign: 'center' as const, overflow: 'visible' as const },
    6: { cellWidth: 130 },
  },
  margin: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_LEFT, right: MARGIN_RIGHT },
};

/** 8-column detail table: # | TAG | Descrição | Bitola | Qtd | Un. | ERP | Notas */
const DETAIL_TABLE_STYLES = {
  styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' as const },
  headStyles: { fillColor: [40, 40, 40] as [number, number, number], textColor: 255 },
  rowPageBreak: 'avoid' as const,
  columnStyles: {
    0: { cellWidth: 20, overflow: 'visible' as const },
    1: { cellWidth: 55, overflow: 'visible' as const },
    2: { cellWidth: 'auto' as const },
    3: { cellWidth: 55, halign: 'center' as const, overflow: 'visible' as const },
    4: { cellWidth: 45, halign: 'center' as const, overflow: 'visible' as const },
    5: { cellWidth: 38, halign: 'center' as const, overflow: 'visible' as const },
    6: { cellWidth: 90, halign: 'center' as const, overflow: 'visible' as const },
    7: { cellWidth: 120 },
  },
  margin: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_LEFT, right: MARGIN_RIGHT },
};

// ---- Table body builders ----

function buildConsolidatedBody(groups: CategoryGroup[]): BodyCell[][] {
  const body: BodyCell[][] = [];
  let rowNum = 0;
  for (const group of groups) {
    const catLabel = group.label ?? 'Sem categoria';
    body.push([
      {
        content: catLabel,
        colSpan: 7,
        styles: { fontStyle: 'bold', fillColor: [220, 220, 220], textColor: 40 },
      },
    ]);
    for (const item of group.items) {
      rowNum++;
      body.push([
        String(rowNum),
        item.descricao,
        item.bitola || '—',
        formatQty(item.quantidade),
        item.unidade || '—',
        item.erp || '—',
        item.notes || '',
      ]);
    }
  }
  return body;
}

function buildDetailBody(groups: CategoryGroup[]): BodyCell[][] {
  const body: BodyCell[][] = [];
  let rowNum = 0;
  for (const group of groups) {
    const catLabel = group.label ?? 'Sem categoria';
    body.push([
      {
        content: catLabel,
        colSpan: 8,
        styles: { fontStyle: 'bold', fillColor: [220, 220, 220], textColor: 40 },
      },
    ]);
    for (const item of group.items) {
      rowNum++;
      body.push([
        String(rowNum),
        item.tag || '—',
        item.descricao,
        item.bitola || '—',
        formatQty(item.quantidade),
        item.unidade || '—',
        item.erp || '—',
        item.notes || '',
      ]);
    }
  }
  return body;
}

// ---- Cover page ----

function flattenChildren(
  children: ExportChildData[],
  depth: number,
): Array<{ child: ExportChildData; depth: number }> {
  const result: Array<{ child: ExportChildData; depth: number }> = [];
  for (const c of children) {
    result.push({ child: c, depth });
    result.push(...flattenChildren(c.children, depth + 1));
  }
  return result;
}

function renderCoverPage(
  doc: jsPDF,
  root: BomRoot,
  version: BomVersion,
  project: { numero: string; descricao: string },
  childConjuntos: ExportChildData[],
  generatedAt: string,
) {
  drawHeaderFooter(doc, generatedAt);
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = MARGIN_TOP + 20;

  // Title
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(`${root.codigo} — ${root.name}`, MARGIN_LEFT, y);
  y += 28;

  // Project subtitle
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60);
  doc.text(`Projeto: ${project.numero} - ${project.descricao}`, MARGIN_LEFT, y);
  doc.setTextColor(0);
  y += 20;

  // Separator
  doc.setDrawColor(180);
  doc.line(MARGIN_LEFT, y, pageWidth - MARGIN_RIGHT, y);
  y += 16;

  // Metadata block (two columns)
  const versionLabel = version.label
    ? `v${version.version_number} — ${version.label}`
    : `v${version.version_number}`;
  const createdAt = format(new Date(version.created_at), 'dd/MM/yyyy');
  const releasedAt = version.released_at
    ? format(new Date(version.released_at), 'dd/MM/yyyy')
    : '—';

  doc.setFontSize(9);
  const col2X = MARGIN_LEFT + (pageWidth - MARGIN_LEFT - MARGIN_RIGHT) / 2 + 10;
  const metaRows: Array<[string, string, string, string]> = [
    ['Revisão:', versionLabel, 'Data de criação:', createdAt],
    ['Status:', version.status, 'Data de liberação:', releasedAt],
  ];

  for (const [l1, v1, l2, v2] of metaRows) {
    doc.setFont('helvetica', 'bold');
    doc.text(l1, MARGIN_LEFT, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v1, MARGIN_LEFT + 70, y);
    doc.setFont('helvetica', 'bold');
    doc.text(l2, col2X, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v2, col2X + 100, y);
    y += 14;
  }
  y += 8;

  // Version notes
  if (version.notes?.trim()) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Notas:', MARGIN_LEFT, y);
    y += 12;
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(60);
    const noteLines = doc.splitTextToSize(
      version.notes,
      pageWidth - MARGIN_LEFT - MARGIN_RIGHT,
    );
    doc.text(noteLines, MARGIN_LEFT, y);
    y += (noteLines as string[]).length * 12 + 8;
    doc.setTextColor(0);
  }

  y += 8;

  // Child conjuntos list
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Conjuntos filhos', MARGIN_LEFT, y);
  y += 14;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  if (childConjuntos.length === 0) {
    doc.text('Nenhum conjunto filho.', MARGIN_LEFT, y);
  } else {
    for (const { child, depth } of flattenChildren(childConjuntos, 0)) {
      const indent = MARGIN_LEFT + depth * 16;
      doc.text(`• ${child.root.codigo} — ${child.root.name}`, indent, y);
      y += 12;
    }
  }
}

// ---- Consolidated page ----

function renderConsolidatedPage(
  doc: jsPDF,
  label: string,
  items: ItemRow[],
  generatedAt: string,
) {
  const consolidated = consolidateItems(items);
  const groups = groupByCategoria(consolidated);

  let y = MARGIN_TOP;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(`Lista Consolidada — ${label}`, MARGIN_LEFT, y);
  y += 18;

  if (consolidated.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Nenhum item neste conjunto.', MARGIN_LEFT, y + 6);
    drawHeaderFooter(doc, generatedAt);
    return;
  }

  const body = buildConsolidatedBody(groups);
  autoTable(doc, {
    startY: y + 4,
    head: [['#', 'Descrição', 'Bitola', 'Qtd.', 'Un.', 'ERP', 'Notas']],
    body: body as Parameters<typeof autoTable>[1]['body'],
    ...CONSOLIDATED_TABLE_STYLES,
    didDrawPage: () => drawHeaderFooter(doc, generatedAt),
  });
}

// ---- Direct items page (root and child roots) ----

function renderDirectItemsPage(
  doc: jsPDF,
  title: string,
  breadcrumb: string[],
  versionInfo: string | null,
  versionNotes: string | null,
  items: ItemRow[],
  generatedAt: string,
) {
  drawHeaderFooter(doc, generatedAt);
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = MARGIN_TOP;

  // Breadcrumb
  if (breadcrumb.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(breadcrumb.join(' › '), MARGIN_LEFT, y - 14, {
      maxWidth: pageWidth - MARGIN_LEFT - MARGIN_RIGHT,
    });
    doc.setTextColor(0);
  }

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(title, MARGIN_LEFT, y);
  y += 16;

  // Optional version info line
  if (versionInfo) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(versionInfo, MARGIN_LEFT, y);
    y += 14;
  }

  // Optional version notes
  if (versionNotes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(80);
    const noteLines = doc.splitTextToSize(
      `Notas: ${versionNotes}`,
      pageWidth - MARGIN_LEFT - MARGIN_RIGHT,
    );
    doc.text(noteLines, MARGIN_LEFT, y);
    y += (noteLines as string[]).length * 12 + 4;
    doc.setTextColor(0);
  }

  y += 4;

  if (items.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120);
    doc.text('Nenhum item direto.', MARGIN_LEFT, y);
    doc.setTextColor(0);
    return;
  }

  const groups = groupByCategoria(items);
  const body = buildDetailBody(groups);
  autoTable(doc, {
    startY: y,
    head: [['#', 'TAG', 'Descrição', 'Bitola', 'Qtd', 'Un.', 'ERP', 'Notas']],
    body: body as Parameters<typeof autoTable>[1]['body'],
    ...DETAIL_TABLE_STYLES,
    didDrawPage: () => drawHeaderFooter(doc, generatedAt),
  });
}

// ---- Subconjunto page ----

function renderSubconjuntoPage(
  doc: jsPDF,
  sub: BomTreeNode,
  breadcrumb: string[],
  matMap: Map<string, MaterialLite>,
  generatedAt: string,
) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.addPage();
  drawHeaderFooter(doc, generatedAt);

  let y = MARGIN_TOP;

  // Breadcrumb
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(breadcrumb.join(' › '), MARGIN_LEFT, y - 14, {
    maxWidth: pageWidth - MARGIN_LEFT - MARGIN_RIGHT,
  });
  doc.setTextColor(0);

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(sub.name ?? '', MARGIN_LEFT, y);
  y += 14;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Quantidade no conjunto: ${formatQty(sub.cumulativeQuantity)}`,
    MARGIN_LEFT,
    y,
  );
  y += 12;

  if (sub.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(80);
    const noteLines = doc.splitTextToSize(
      `Notas: ${sub.notes}`,
      pageWidth - MARGIN_LEFT - MARGIN_RIGHT,
    );
    doc.text(noteLines, MARGIN_LEFT, y);
    y += (noteLines as string[]).length * 12 + 2;
    doc.setTextColor(0);
  }

  y += 4;

  const items = collectItems(sub, sub.cumulativeQuantity, matMap);

  if (items.length === 0) {
    doc.setFontSize(10);
    doc.text('Nenhum item neste subconjunto.', MARGIN_LEFT, y);
    return;
  }

  const groups = groupByCategoria(items);
  const body = buildDetailBody(groups);

  let pageIdx = 0;
  autoTable(doc, {
    startY: y,
    head: [['#', 'TAG', 'Descrição', 'Bitola', 'Qtd', 'Un.', 'ERP', 'Notas']],
    body: body as Parameters<typeof autoTable>[1]['body'],
    ...DETAIL_TABLE_STYLES,
    showHead: 'everyPage',
    willDrawPage: () => {
      if (pageIdx > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(80);
        doc.text(`${sub.name ?? ''} — continuação`, MARGIN_LEFT, MARGIN_TOP - 14);
        doc.setTextColor(0);
      }
    },
    didDrawPage: () => {
      drawHeaderFooter(doc, generatedAt);
      pageIdx += 1;
    },
  });
}

// ---- Child root section ----

/** Recursively render a child BomRoot section: direct items page → subconjunto pages → nested children. */
function renderChildSection(
  doc: jsPDF,
  child: ExportChildData,
  matMap: Map<string, MaterialLite>,
  generatedAt: string,
) {
  const childLabel = `${child.root.codigo} — ${child.root.name}`;
  const childBreadcrumb = [...child.breadcrumb, childLabel];

  const childVersionLabel = child.version.label
    ? `v${child.version.version_number} — ${child.version.label}`
    : `v${child.version.version_number}`;
  const qtyInParent = child.root.quantity_in_parent ?? 1;
  const versionInfo = qtyInParent !== 1
    ? `Versão: ${childVersionLabel}  |  Status: ${child.version.status}  |  Quantidade no pai: ${formatQty(qtyInParent)}`
    : `Versão: ${childVersionLabel}  |  Status: ${child.version.status}`;

  const directItems = collectDirectItems(child.tree, matMap);

  doc.addPage();
  renderDirectItemsPage(
    doc,
    `${childLabel} (itens diretos)`,
    child.breadcrumb,
    versionInfo,
    child.version.notes ?? null,
    directItems,
    generatedAt,
  );

  // Per-subconjunto pages within this child root's own BOM tree
  for (const { node: sub, breadcrumb } of collectAllSubconjuntos(child.tree, childBreadcrumb)) {
    renderSubconjuntoPage(doc, sub, breadcrumb, matMap, generatedAt);
  }

  // Recurse into nested child BomRoots
  for (const grandchild of child.children) {
    renderChildSection(doc, grandchild, matMap, generatedAt);
  }
}

// ---- Main export function ----

export function exportConjuntoPdf(
  root: BomRoot,
  version: BomVersion,
  tree: BomTreeNode,
  matMap: Map<string, MaterialLite>,
  childConjuntos: ExportChildData[] = [],
  project: { numero: string; descricao: string },
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const generatedAt = format(new Date(), 'dd/MM/yyyy HH:mm');
  const rootLabel = `${root.codigo} — ${root.name}`;

  // ---- Page 1: Cover page ----
  renderCoverPage(doc, root, version, project, childConjuntos, generatedAt);

  // ---- Page 2: Consolidated list (own tree + all descendant child BomRoots) ----
  doc.addPage();
  const allItems = collectAllItems(tree, matMap, childConjuntos);
  renderConsolidatedPage(doc, rootLabel, allItems, generatedAt);

  // ---- Page 3: Root direct items ----
  doc.addPage();
  const rootDirectItems = collectDirectItems(tree, matMap);
  renderDirectItemsPage(
    doc,
    `${rootLabel} (itens diretos)`,
    [],
    null,
    null,
    rootDirectItems,
    generatedAt,
  );

  // ---- Subconjunto pages for root's own BOM tree ----
  const rootBreadcrumb = [rootLabel];
  for (const { node: sub, breadcrumb } of collectAllSubconjuntos(tree, rootBreadcrumb)) {
    renderSubconjuntoPage(doc, sub, breadcrumb, matMap, generatedAt);
  }

  // ---- Child BomRoot sections ----
  for (const child of childConjuntos) {
    renderChildSection(doc, child, matMap, generatedAt);
  }

  if (typeof (doc as unknown as { putTotalPages?: (s: string) => void }).putTotalPages === 'function') {
    (doc as unknown as { putTotalPages: (s: string) => void }).putTotalPages(TOTAL_PAGES_PLACEHOLDER);
  }

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

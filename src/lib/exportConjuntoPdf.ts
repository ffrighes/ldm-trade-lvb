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

interface ItemRow {
  materialId: string | null;
  /** node.name — the TAG shown in the BOM view */
  tag: string;
  descricao: string;
  bitola: string;
  erp: string;
  unidade: string;
  quantidade: number;
  notes: string | null;
}

/** Collect all ITEM nodes from a subtree. baseCumulative normalises quantities (e.g. qty per subconjunto unit). */
function collectItems(
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
      notes: node.notes ?? null,
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
        notes: c.notes ?? null,
      };
    });
}

/**
 * Collect ALL items from a BOM tree AND from all nested child BomRoots (recursively).
 * Child BomRoot quantities are treated as qty=1 relative to the parent root since
 * no explicit quantity is stored for that relationship.
 */
function collectAllItems(
  tree: BomTreeNode,
  matMap: Map<string, MaterialLite>,
  childRoots: ExportChildData[],
): ItemRow[] {
  const items = collectItems(tree, 1, matMap);
  for (const child of childRoots) {
    items.push(...collectAllItems(child.tree, matMap, child.children));
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
    } else {
      map.set(key, { ...r });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.descricao.localeCompare(b.descricao, 'pt-BR', { numeric: true, sensitivity: 'base' }),
  );
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

/** 5-column consolidated table: Descrição | Bitola | ERP | Quantidade | Unidade */
const CONSOLIDATED_TABLE_STYLES = {
  styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' as const },
  headStyles: { fillColor: [40, 40, 40] as [number, number, number], textColor: 255 },
  columnStyles: {
    0: { cellWidth: 'auto' as const },
    1: { cellWidth: 70 },
    2: { cellWidth: 70 },
    3: { cellWidth: 70, halign: 'right' as const },
    4: { cellWidth: 60 },
  },
  margin: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_LEFT, right: MARGIN_RIGHT },
};

/** 8-column detail table: # | TAG | Descrição | Bitola | ERP | Qtd/unid. | Unidade | Notas */
const DETAIL_TABLE_STYLES = {
  styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' as const },
  headStyles: { fillColor: [40, 40, 40] as [number, number, number], textColor: 255 },
  columnStyles: {
    0: { cellWidth: 20 },
    1: { cellWidth: 48 },
    2: { cellWidth: 'auto' as const },
    3: { cellWidth: 50 },
    4: { cellWidth: 50 },
    5: { cellWidth: 44, halign: 'right' as const },
    6: { cellWidth: 38 },
    7: { cellWidth: 85 },
  },
  margin: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_LEFT, right: MARGIN_RIGHT },
};

// ---- Page rendering helpers ----

function renderConsolidatedPage(
  doc: jsPDF,
  label: string,
  subtitle: string,
  items: ItemRow[],
  generatedAt: string,
  versionNotes?: string | null,
) {
  const consolidated = consolidateItems(items);
  const body = consolidated.map((r) => [
    r.descricao,
    r.bitola || '—',
    r.erp || '—',
    formatQty(r.quantidade),
    r.unidade || '—',
  ]);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = MARGIN_TOP;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(label, MARGIN_LEFT, y);
  y += 16;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, MARGIN_LEFT, y);
  y += 14;

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

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Lista Consolidada de Itens', MARGIN_LEFT, y);
  y += 12;

  if (body.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Nenhum item neste conjunto.', MARGIN_LEFT, y + 6);
    drawHeaderFooter(doc, generatedAt);
  } else {
    autoTable(doc, {
      startY: y + 6,
      head: [['Descrição', 'Bitola', 'ERP', 'Quantidade', 'Unidade']],
      body,
      ...CONSOLIDATED_TABLE_STYLES,
      didDrawPage: () => drawHeaderFooter(doc, generatedAt),
    });
  }
}

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

  // Subconjunto notes
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

  // Items — individual rows with TAG and Notas (no consolidation)
  const items = collectItems(sub, sub.cumulativeQuantity, matMap);

  if (items.length === 0) {
    doc.setFontSize(10);
    doc.text('Nenhum item neste subconjunto.', MARGIN_LEFT, y);
    return;
  }

  const body = items.map((r, idx) => [
    String(idx + 1),
    r.tag || '—',
    r.descricao,
    r.bitola || '—',
    r.erp || '—',
    formatQty(r.quantidade),
    r.unidade || '—',
    r.notes || '',
  ]);

  let pageIdx = 0;
  autoTable(doc, {
    startY: y,
    head: [['#', 'TAG', 'Descrição', 'Bitola', 'ERP', 'Qtd/unid.', 'Unidade', 'Notas']],
    body,
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

/**
 * Render the section page for a child BomRoot.
 * Shows the child label, version notes, and direct items (with TAG + Notas).
 * Does NOT consolidate — only the top-level parent list consolidates.
 */
function renderChildRootPage(
  doc: jsPDF,
  child: ExportChildData,
  matMap: Map<string, MaterialLite>,
  generatedAt: string,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const childLabel = `${child.root.codigo} — ${child.root.name}`;
  const childVersionLabel = child.version.label
    ? `v${child.version.version_number} — ${child.version.label}`
    : `v${child.version.version_number}`;

  doc.addPage();
  drawHeaderFooter(doc, generatedAt);

  let y = MARGIN_TOP;

  // Breadcrumb
  if (child.breadcrumb.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(child.breadcrumb.join(' › '), MARGIN_LEFT, y - 14, {
      maxWidth: pageWidth - MARGIN_LEFT - MARGIN_RIGHT,
    });
    doc.setTextColor(0);
  }

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(childLabel, MARGIN_LEFT, y);
  y += 16;

  // Version info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Versão: ${childVersionLabel}  |  Status: ${child.version.status}`,
    MARGIN_LEFT,
    y,
  );
  y += 14;

  // Version notes
  if (child.version.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(80);
    const noteLines = doc.splitTextToSize(
      `Notas: ${child.version.notes}`,
      pageWidth - MARGIN_LEFT - MARGIN_RIGHT,
    );
    doc.text(noteLines, MARGIN_LEFT, y);
    y += (noteLines as string[]).length * 12 + 4;
    doc.setTextColor(0);
  }

  y += 4;

  // Direct ITEM children (not in any subconjunto)
  const directItems = collectDirectItems(child.tree, matMap);

  if (directItems.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120);
    doc.text('(sem itens diretos — ver subconjuntos)', MARGIN_LEFT, y);
    doc.setTextColor(0);
    return;
  }

  const body = directItems.map((r, idx) => [
    String(idx + 1),
    r.tag || '—',
    r.descricao,
    r.bitola || '—',
    r.erp || '—',
    formatQty(r.quantidade),
    r.unidade || '—',
    r.notes || '',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'TAG', 'Descrição', 'Bitola', 'ERP', 'Qtd/unid.', 'Unidade', 'Notas']],
    body,
    ...DETAIL_TABLE_STYLES,
    didDrawPage: () => drawHeaderFooter(doc, generatedAt),
  });
}

/** Recursively render a child BomRoot section: header page (with TAG/Notas) → subconjunto pages → nested children. */
function renderChildSection(
  doc: jsPDF,
  child: ExportChildData,
  matMap: Map<string, MaterialLite>,
  generatedAt: string,
) {
  const childLabel = `${child.root.codigo} — ${child.root.name}`;
  const childBreadcrumb = [...child.breadcrumb, childLabel];

  // Header page with direct items (TAG + Notas) — no consolidation for child lists
  renderChildRootPage(doc, child, matMap, generatedAt);

  // Per-subconjunto pages within this child root's own BOM tree (individual items with TAG + Notas)
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
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const generatedAt = format(new Date(), 'dd/MM/yyyy HH:mm');
  const versionLabel = version.label
    ? `v${version.version_number} — ${version.label}`
    : `v${version.version_number}`;
  const subtitle = `Versão: ${versionLabel}  |  Status: ${version.status}`;
  const rootLabel = `${root.codigo} — ${root.name}`;

  // ---- Page 1: consolidated list (own tree + all descendant child BomRoots) ----
  const allItems = collectAllItems(tree, matMap, childConjuntos);
  renderConsolidatedPage(doc, rootLabel, subtitle, allItems, generatedAt, version.notes);

  // ---- Per-subconjunto pages for root's own BOM tree (individual items with TAG + Notas) ----
  const rootBreadcrumb = [rootLabel];
  for (const { node: sub, breadcrumb } of collectAllSubconjuntos(tree, rootBreadcrumb)) {
    renderSubconjuntoPage(doc, sub, breadcrumb, matMap, generatedAt);
  }

  // ---- Child BomRoot sections (no consolidation — only parent consolidates) ----
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

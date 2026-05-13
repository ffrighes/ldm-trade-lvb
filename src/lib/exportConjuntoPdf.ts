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
    });
  }
  for (const child of node.children) {
    items.push(...collectItems(child, baseCumulative, matMap));
  }
  return items;
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

/** 7-column detail table: # | TAG | Descrição | Bitola | ERP | Qtd/unid. | Unidade */
const DETAIL_TABLE_STYLES = {
  styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' as const },
  headStyles: { fillColor: [40, 40, 40] as [number, number, number], textColor: 255 },
  columnStyles: {
    0: { cellWidth: 22 },
    1: { cellWidth: 56 },
    2: { cellWidth: 'auto' as const },
    3: { cellWidth: 56 },
    4: { cellWidth: 56 },
    5: { cellWidth: 48, halign: 'right' as const },
    6: { cellWidth: 40 },
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
) {
  const consolidated = consolidateItems(items);
  const body = consolidated.map((r) => [
    r.descricao,
    r.bitola || '—',
    r.erp || '—',
    formatQty(r.quantidade),
    r.unidade || '—',
  ]);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(label, MARGIN_LEFT, MARGIN_TOP);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, MARGIN_LEFT, MARGIN_TOP + 16);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Lista Consolidada de Itens', MARGIN_LEFT, MARGIN_TOP + 34);

  if (body.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Nenhum item neste conjunto.', MARGIN_LEFT, MARGIN_TOP + 52);
    drawHeaderFooter(doc, generatedAt);
  } else {
    autoTable(doc, {
      startY: MARGIN_TOP + 46,
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

  // Breadcrumb
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(breadcrumb.join(' › '), MARGIN_LEFT, MARGIN_TOP - 14, {
    maxWidth: pageWidth - MARGIN_LEFT - MARGIN_RIGHT,
  });
  doc.setTextColor(0);

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(sub.name ?? '', MARGIN_LEFT, MARGIN_TOP);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Quantidade no conjunto: ${formatQty(sub.cumulativeQuantity)}`,
    MARGIN_LEFT,
    MARGIN_TOP + 14,
  );

  // Items — individual rows with TAG (no consolidation)
  const items = collectItems(sub, sub.cumulativeQuantity, matMap);

  if (items.length === 0) {
    doc.setFontSize(10);
    doc.text('Nenhum item neste subconjunto.', MARGIN_LEFT, MARGIN_TOP + 32);
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
  ]);

  let pageIdx = 0;
  autoTable(doc, {
    startY: MARGIN_TOP + 26,
    head: [['#', 'TAG', 'Descrição', 'Bitola', 'ERP', 'Qtd/unid.', 'Unidade']],
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

/** Recursively render a child BomRoot section: consolidated page → subconjunto pages → nested children. */
function renderChildSection(
  doc: jsPDF,
  child: ExportChildData,
  matMap: Map<string, MaterialLite>,
  generatedAt: string,
) {
  const childLabel = `${child.root.codigo} — ${child.root.name}`;
  const childVersionLabel = child.version.label
    ? `v${child.version.version_number} — ${child.version.label}`
    : `v${child.version.version_number}`;
  const childSubtitle = `Versão: ${childVersionLabel}  |  Status: ${child.version.status}`;

  // Consolidated page for this child root (includes all descendant BomRoot items)
  doc.addPage();
  drawHeaderFooter(doc, generatedAt);

  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(child.breadcrumb.join(' › '), MARGIN_LEFT, MARGIN_TOP - 14, {
    maxWidth: pageWidth - MARGIN_LEFT - MARGIN_RIGHT,
  });
  doc.setTextColor(0);

  const allChildItems = collectAllItems(child.tree, matMap, child.children);
  renderConsolidatedPage(doc, childLabel, childSubtitle, allChildItems, generatedAt);

  // Per-subconjunto pages within this child root's own BOM tree (individual items with TAG)
  const childRootBreadcrumb = [...child.breadcrumb, childLabel];
  for (const { node: sub, breadcrumb } of collectAllSubconjuntos(child.tree, childRootBreadcrumb)) {
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
  renderConsolidatedPage(doc, rootLabel, subtitle, allItems, generatedAt);

  // ---- Per-subconjunto pages for root's own BOM tree (individual items with TAG) ----
  const rootBreadcrumb = [rootLabel];
  for (const { node: sub, breadcrumb } of collectAllSubconjuntos(tree, rootBreadcrumb)) {
    renderSubconjuntoPage(doc, sub, breadcrumb, matMap, generatedAt);
  }

  // ---- Child BomRoot sections (recursive) ----
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

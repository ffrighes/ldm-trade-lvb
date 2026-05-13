import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { BomRoot, BomTreeNode, BomVersion } from '@/types/bom';

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
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

interface ItemRow {
  materialId: string | null;
  descricao: string;
  bitola: string;
  erp: string;
  unidade: string;
  quantidade: number;
}

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

interface SubconjuntoEntry {
  node: BomTreeNode;
  breadcrumb: string[];
}

function collectAllSubconjuntos(
  node: BomTreeNode,
  breadcrumb: string[],
): SubconjuntoEntry[] {
  const result: SubconjuntoEntry[] = [];
  for (const child of node.children) {
    if (child.node_type === 'SUBCONJUNTO') {
      result.push({ node: child, breadcrumb });
      result.push(...collectAllSubconjuntos(child, [...breadcrumb, child.name ?? '']));
    }
  }
  return result;
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

const TABLE_STYLES = {
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

export function exportConjuntoPdf(
  root: BomRoot,
  version: BomVersion,
  tree: BomTreeNode,
  matMap: Map<string, MaterialLite>,
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const generatedAt = format(new Date(), 'dd/MM/yyyy HH:mm');
  const versionLabel = version.label
    ? `v${version.version_number} — ${version.label}`
    : `v${version.version_number}`;

  // ---- Page 1: consolidated list ----
  const allItems = collectItems(tree, 1, matMap);
  const consolidated = consolidateItems(allItems);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(`${root.codigo} — ${root.name}`, MARGIN_LEFT, MARGIN_TOP);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Versão: ${versionLabel}  |  Status: ${version.status}`,
    MARGIN_LEFT,
    MARGIN_TOP + 16,
  );

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Lista Consolidada de Itens', MARGIN_LEFT, MARGIN_TOP + 34);

  const consolidatedBody = consolidated.map((r) => [
    r.descricao,
    r.bitola,
    r.erp,
    formatQty(r.quantidade),
    r.unidade,
  ]);

  if (consolidatedBody.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Nenhum item neste conjunto.', MARGIN_LEFT, MARGIN_TOP + 52);
    drawHeaderFooter(doc, generatedAt);
  } else {
    autoTable(doc, {
      startY: MARGIN_TOP + 46,
      head: [['Descrição', 'Bitola', 'ERP', 'Quantidade', 'Unidade']],
      body: consolidatedBody,
      ...TABLE_STYLES,
      didDrawPage: () => drawHeaderFooter(doc, generatedAt),
    });
  }

  // ---- Per-subconjunto pages (all levels, depth-first) ----
  const rootBreadcrumb = [`${root.codigo} — ${root.name}`];
  const allSubconjuntos = collectAllSubconjuntos(tree, rootBreadcrumb);

  for (const { node: sub, breadcrumb } of allSubconjuntos) {
    doc.addPage();
    drawHeaderFooter(doc, generatedAt);

    const pageWidth = doc.internal.pageSize.getWidth();
    const breadcrumbText = breadcrumb.join(' › ');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(breadcrumbText, MARGIN_LEFT, MARGIN_TOP - 14, {
      maxWidth: pageWidth - MARGIN_LEFT - MARGIN_RIGHT,
    });
    doc.setTextColor(0);

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

    const subItems = collectItems(sub, sub.cumulativeQuantity, matMap);
    const consolidatedSub = consolidateItems(subItems);

    if (consolidatedSub.length === 0) {
      doc.setFontSize(10);
      doc.text('Nenhum item neste subconjunto.', MARGIN_LEFT, MARGIN_TOP + 32);
      continue;
    }

    const subBody = consolidatedSub.map((r) => [
      r.descricao,
      r.bitola,
      r.erp,
      formatQty(r.quantidade),
      r.unidade,
    ]);

    let pageIdx = 0;
    autoTable(doc, {
      startY: MARGIN_TOP + 26,
      head: [['Descrição', 'Bitola', 'ERP', 'Qtd/unid.', 'Unidade']],
      body: subBody,
      ...TABLE_STYLES,
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

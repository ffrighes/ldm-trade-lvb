import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface MaterialLite {
  id: string;
  descricao: string;
  bitola: string;
  unidade: string;
  erp?: string | null;
  categoria?: string | null;
}

interface ProjectLite {
  id: string;
  numero: string;
  descricao: string;
}

interface SolicitacaoItemLite {
  descricao: string;
  bitola: string;
  unidade: string;
  quantidade: number;
  material_id?: string | null;
  tag?: string | null;
}

interface SolicitacaoLite {
  id: string;
  numero: string;
  projeto_id: string;
  status: string;
  motivo?: string | null;
  data_solicitacao: string;
  revisao?: string | null;
  erp?: string | null;
  notas?: string | null;
  solicitacao_itens?: SolicitacaoItemLite[];
}

const MARGIN_LEFT = 40;
const MARGIN_RIGHT = 40;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 36;
const TOTAL_PAGES_PLACEHOLDER = '{total_pages}';
const NO_CATEGORY = 'Sem categoria';

function timestampSuffix(): string {
  return format(new Date(), 'yyyyMMdd_HHmm');
}

function projectLabel(projects: ProjectLite[], id: string): string {
  const p = projects.find((x) => x.id === id);
  return p ? `${p.numero} - ${p.descricao}` : '';
}

function formatQty(n: number): string {
  const v = Number(n ?? 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

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

export function exportSolicitacoesToPdf(
  solicitacoes: SolicitacaoLite[],
  projects: ProjectLite[],
  materials: MaterialLite[],
  filename = `Solicitacoes_Consolidado_${timestampSuffix()}.pdf`,
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const generatedAt = format(new Date(), 'dd/MM/yyyy HH:mm');
  const pageWidth = doc.internal.pageSize.getWidth();
  const usableWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;

  const sorted = [...solicitacoes].sort((a, b) =>
    a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true, sensitivity: 'base' }),
  );

  const matMap = new Map(materials.map((m) => [m.id, m]));

  // ---- Consolidated material list ----
  type ConsolidatedRow = {
    categoria: string;
    descricao: string;
    bitola: string;
    erp: string;
    quantidade: number;
    unidade: string;
  };
  const consolidated = new Map<string, ConsolidatedRow>();
  for (const s of sorted) {
    for (const it of s.solicitacao_itens ?? []) {
      const mat = it.material_id ? matMap.get(it.material_id) : undefined;
      const erp = mat?.erp ?? '';
      const categoria = mat?.categoria || NO_CATEGORY;
      const idKey = mat?.id ?? `${(it.descricao ?? '').trim()}|${(it.bitola ?? '').trim()}`;
      const key = `${idKey}|${(it.unidade ?? '').trim()}`;
      const existing = consolidated.get(key);
      const qty = Number(it.quantidade ?? 0);
      if (existing) {
        existing.quantidade += qty;
      } else {
        consolidated.set(key, {
          categoria,
          descricao: it.descricao ?? '',
          bitola: it.bitola ?? '',
          erp,
          quantidade: qty,
          unidade: it.unidade ?? '',
        });
      }
    }
  }
  const consolidatedRows = [...consolidated.values()].sort((a, b) => {
    const c = a.categoria.localeCompare(b.categoria, 'pt-BR', { numeric: true, sensitivity: 'base' });
    if (c !== 0) return c;
    return a.descricao.localeCompare(b.descricao, 'pt-BR', { numeric: true, sensitivity: 'base' });
  });

  // ---- Page 1: consolidated ----
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Lista Consolidada de Materiais', MARGIN_LEFT, MARGIN_TOP);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const numerosLabel = `Solicitações: ${sorted.map((s) => s.numero).join(', ')}`;
  const numerosLines = doc.splitTextToSize(numerosLabel, usableWidth);
  doc.text(numerosLines, MARGIN_LEFT, MARGIN_TOP + 18);

  const consolidatedBody: (string | { content: string; colSpan: number; styles: Record<string, unknown> })[][] = [];
  let currentCat: string | null = null;
  for (const r of consolidatedRows) {
    if (r.categoria !== currentCat) {
      currentCat = r.categoria;
      consolidatedBody.push([
        {
          content: r.categoria,
          colSpan: 5,
          styles: { fillColor: [230, 230, 230], fontStyle: 'bold', textColor: 20 },
        },
      ]);
    }
    consolidatedBody.push([r.descricao, r.bitola, r.erp, formatQty(r.quantidade), r.unidade]);
  }

  const consolidatedStartY = MARGIN_TOP + 18 + numerosLines.length * 11 + 10;
  if (consolidatedBody.length === 0) {
    doc.setFontSize(10);
    doc.text('Nenhum item para consolidar.', MARGIN_LEFT, consolidatedStartY);
  } else {
    autoTable(doc, {
      startY: consolidatedStartY,
      head: [['Descrição', 'Bitola', 'ERP', 'Quantidade', 'Unidade']],
      body: consolidatedBody,
      styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [40, 40, 40], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 70 },
        2: { cellWidth: 70 },
        3: { cellWidth: 70, halign: 'right' },
        4: { cellWidth: 60 },
      },
      margin: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_LEFT, right: MARGIN_RIGHT },
      didDrawPage: () => drawHeaderFooter(doc, generatedAt),
    });
  }

  // ---- Per-solicitação pages ----
  for (const s of sorted) {
    doc.addPage();
    drawHeaderFooter(doc, generatedAt);

    const projetoLabel = projectLabel(projects, s.projeto_id);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(`Solicitação ${s.numero}`, MARGIN_LEFT, MARGIN_TOP);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let y = MARGIN_TOP + 16;
    const metaLines = [
      `Projeto: ${projetoLabel}`,
      `Status: ${s.status}`,
      `Data: ${s.data_solicitacao ?? ''}`,
      `Revisão: ${s.revisao ?? ''}`,
      `ERP: ${s.erp ?? ''}`,
      `Motivo: ${s.motivo ?? ''}`,
    ];
    for (const line of metaLines) {
      const split = doc.splitTextToSize(line, usableWidth);
      doc.text(split, MARGIN_LEFT, y);
      y += split.length * 11;
    }

    const itens = s.solicitacao_itens ?? [];
    const body = itens.map((it) => {
      const mat = it.material_id ? matMap.get(it.material_id) : undefined;
      return [
        it.tag ?? '-',
        it.descricao ?? '',
        it.bitola ?? '',
        mat?.erp ?? '',
        formatQty(Number(it.quantidade ?? 0)),
        it.unidade ?? '',
      ];
    });

    if (body.length === 0) {
      doc.setFontSize(10);
      doc.text('Sem itens nesta solicitação.', MARGIN_LEFT, y + 8);
      continue;
    }

    let tablePageIdx = 0;
    autoTable(doc, {
      startY: y + 8,
      head: [['TAG', 'Descrição', 'Bitola', 'ERP', 'Quantidade', 'Unidade']],
      body,
      styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [40, 40, 40], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 60 },
        3: { cellWidth: 60 },
        4: { cellWidth: 70, halign: 'right' },
        5: { cellWidth: 60 },
      },
      showHead: 'everyPage',
      margin: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_LEFT, right: MARGIN_RIGHT },
      willDrawPage: () => {
        if (tablePageIdx > 0) {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(80);
          doc.text(
            `Solicitação ${s.numero} — continuação`,
            MARGIN_LEFT,
            MARGIN_TOP - 16,
          );
          doc.setTextColor(0);
        }
      },
      didDrawPage: () => {
        drawHeaderFooter(doc, generatedAt);
        tablePageIdx += 1;
      },
    });
  }

  // Replace placeholder with final total page count.
  if (typeof (doc as unknown as { putTotalPages?: (s: string) => void }).putTotalPages === 'function') {
    (doc as unknown as { putTotalPages: (s: string) => void }).putTotalPages(TOTAL_PAGES_PLACEHOLDER);
  }

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    // Popup blocked — fall back to download so the user still gets the file.
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  // Revoke the object URL after the new tab has had time to load it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

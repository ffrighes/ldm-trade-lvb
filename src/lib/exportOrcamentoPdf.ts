import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  calcPrecoFinal,
  bestPriceIndex,
  formatBRL,
  type RegimeTributario,
} from './orcamentoMath';
import type { OrcamentoDetalhe, OrcamentoItem, OrcamentoItemCotacao } from '@/hooks/useOrcamentos';

const MARGIN_LEFT   = 40;
const MARGIN_RIGHT  = 40;
const MARGIN_TOP    = 56;
const MARGIN_BOTTOM = 36;
const TOTAL_PAGES   = '{total_pages}';

function drawHeaderFooter(doc: jsPDF, generatedAt: string) {
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageNum    = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text('LDM Trade', MARGIN_LEFT, 24);
  doc.text(`Emitido em ${generatedAt}`, pageWidth - MARGIN_RIGHT, 24, { align: 'right' });
  doc.text(`Página ${pageNum} de ${TOTAL_PAGES}`, pageWidth / 2, pageHeight - 18, { align: 'center' });
  doc.setTextColor(0);
}

function formatQty(n: number): string {
  const v = Number(n ?? 0);
  if (isNaN(v)) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function renderCoverPage(
  doc: jsPDF,
  orc: OrcamentoDetalhe,
  projeto: { numero: string; descricao: string },
  generatedAt: string,
) {
  drawHeaderFooter(doc, generatedAt);
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = MARGIN_TOP + 20;

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(orc.nome, MARGIN_LEFT, y);
  y += 28;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60);
  doc.text(`Projeto: ${projeto.numero} — ${projeto.descricao}`, MARGIN_LEFT, y);
  doc.setTextColor(0);
  y += 20;

  doc.setDrawColor(180);
  doc.line(MARGIN_LEFT, y, pageWidth - MARGIN_RIGHT, y);
  y += 16;

  doc.setFontSize(9);
  const col2X = MARGIN_LEFT + (pageWidth - MARGIN_LEFT - MARGIN_RIGHT) / 2 + 10;

  const metaRows: [string, string, string, string][] = [
    ['Número:', orc.numero, 'Emitido em:', generatedAt],
    [
      'Origem BOM:',
      orc.origem_bom_root_codigo
        ? `${orc.origem_bom_root_codigo}${orc.origem_bom_version_label ? ` v${orc.origem_bom_version_label}` : ''}`
        : '—',
      'Itens:',
      String(orc.itens.length),
    ],
    ['Fornecedores:', String(orc.fornecedores.length), '', ''],
  ];

  for (const [l1, v1, l2, v2] of metaRows) {
    doc.setFont('helvetica', 'bold');
    doc.text(l1, MARGIN_LEFT, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v1, MARGIN_LEFT + 80, y);
    if (l2) {
      doc.setFont('helvetica', 'bold');
      doc.text(l2, col2X, y);
      doc.setFont('helvetica', 'normal');
      doc.text(v2, col2X + 80, y);
    }
    y += 14;
  }
  y += 10;

  if (orc.notas?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.text('Notas:', MARGIN_LEFT, y);
    y += 12;
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(60);
    const lines = doc.splitTextToSize(orc.notas, pageWidth - MARGIN_LEFT - MARGIN_RIGHT);
    doc.text(lines, MARGIN_LEFT, y);
    y += (lines as string[]).length * 12 + 8;
    doc.setTextColor(0);
  }

  y += 10;

  // Totais por fornecedor na capa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Totais por fornecedor', MARGIN_LEFT, y);
  y += 14;

  const fornRows = orc.fornecedores.map((of) => {
    const regime = (of.fornecedor.regime_tributario as RegimeTributario) ?? 'lucro_real';
    const total = orc.itens.reduce((acc, item) => {
      const cot = orc.cotacoes.find(
        (c) => c.item_id === item.id && c.fornecedor_id === of.fornecedor_id,
      );
      if (!cot || cot.sem_cotacao_vigente) return acc;
      return acc + calcPrecoFinal(cot, regime).preco_final_unit * item.quantidade;
    }, 0);
    return [of.fornecedor.nome, of.fornecedor.regime_tributario.replace(/_/g, ' '), formatBRL(total)];
  });

  autoTable(doc, {
    startY: y,
    head: [['Fornecedor', 'Regime tributário', 'Total']],
    body: fornRows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 40, 40] as [number, number, number], textColor: 255 },
    margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
    didDrawPage: () => drawHeaderFooter(doc, generatedAt),
  });
}

function renderMatrizPage(
  doc: jsPDF,
  orc: OrcamentoDetalhe,
  generatedAt: string,
  fornecedorChunk: OrcamentoDetalhe['fornecedores'],
  chunkIdx: number,
  totalChunks: number,
) {
  drawHeaderFooter(doc, generatedAt);
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = MARGIN_TOP;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  const title =
    totalChunks > 1
      ? `Matriz Comparativa — parte ${chunkIdx + 1}/${totalChunks}`
      : 'Matriz Comparativa';
  doc.text(title, MARGIN_LEFT, y);
  y += 18;

  const cotMap = new Map<string, OrcamentoItemCotacao>();
  for (const c of orc.cotacoes) cotMap.set(`${c.item_id}|${c.fornecedor_id}`, c);

  const head = [
    ['#', 'Descrição', 'Bitola', 'Qtd.', 'Un.', ...fornecedorChunk.map((f) => f.fornecedor.nome)],
  ];

  const body = orc.itens.map((item, idx) => {
    const lineTotals = fornecedorChunk.map((of) => {
      const regime = (of.fornecedor.regime_tributario as RegimeTributario) ?? 'lucro_real';
      const cot = cotMap.get(`${item.id}|${of.fornecedor_id}`);
      if (!cot || cot.sem_cotacao_vigente) return Infinity;
      return calcPrecoFinal(cot, regime).preco_final_unit * item.quantidade;
    });
    const semCotacao = fornecedorChunk.map((of) => {
      const cot = cotMap.get(`${item.id}|${of.fornecedor_id}`);
      return !cot || cot.sem_cotacao_vigente;
    });
    const bestIdx = bestPriceIndex(lineTotals, semCotacao);

    const fornCols = fornecedorChunk.map((of, fi) => {
      const regime = (of.fornecedor.regime_tributario as RegimeTributario) ?? 'lucro_real';
      const cot = cotMap.get(`${item.id}|${of.fornecedor_id}`);
      if (!cot) return '—';
      if (cot.sem_cotacao_vigente) return 'Sem cotação';
      const total = calcPrecoFinal(cot, regime).preco_final_unit * item.quantidade;
      return fi === bestIdx ? `★ ${formatBRL(total)}` : formatBRL(total);
    });

    return [
      String(idx + 1),
      item.descricao,
      item.bitola || '—',
      formatQty(item.quantidade),
      item.unidade || '—',
      ...fornCols,
    ];
  });

  // Footer row: totais
  const totaisRow = [
    '',
    'TOTAL',
    '',
    '',
    '',
    ...fornecedorChunk.map((of) => {
      const regime = (of.fornecedor.regime_tributario as RegimeTributario) ?? 'lucro_real';
      const total = orc.itens.reduce((acc, item) => {
        const cot = cotMap.get(`${item.id}|${of.fornecedor_id}`);
        if (!cot || cot.sem_cotacao_vigente) return acc;
        return acc + calcPrecoFinal(cot, regime).preco_final_unit * item.quantidade;
      }, 0);
      return formatBRL(total);
    }),
  ];

  autoTable(doc, {
    startY: y,
    head,
    body: [...body, totaisRow],
    styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' as const },
    headStyles: { fillColor: [40, 40, 40] as [number, number, number], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 'auto' as const },
      2: { cellWidth: 55 },
      3: { cellWidth: 35, halign: 'center' as const },
      4: { cellWidth: 30, halign: 'center' as const },
    },
    didParseCell: (data) => {
      // Bold total row
      if (data.row.index === body.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [220, 220, 220];
      }
    },
    margin: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_LEFT, right: MARGIN_RIGHT },
    tableWidth: pageWidth - MARGIN_LEFT - MARGIN_RIGHT,
    didDrawPage: () => drawHeaderFooter(doc, generatedAt),
  });
}

function renderRankingPage(doc: jsPDF, orc: OrcamentoDetalhe, generatedAt: string) {
  drawHeaderFooter(doc, generatedAt);
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = MARGIN_TOP;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Ranking de fornecedores por total', MARGIN_LEFT, y);
  y += 18;

  const cotMap = new Map<string, OrcamentoItemCotacao>();
  for (const c of orc.cotacoes) cotMap.set(`${c.item_id}|${c.fornecedor_id}`, c);

  const ranking = orc.fornecedores
    .map((of) => {
      const regime = (of.fornecedor.regime_tributario as RegimeTributario) ?? 'lucro_real';
      const total = orc.itens.reduce((acc, item) => {
        const cot = cotMap.get(`${item.id}|${of.fornecedor_id}`);
        if (!cot || cot.sem_cotacao_vigente) return acc;
        return acc + calcPrecoFinal(cot, regime).preco_final_unit * item.quantidade;
      }, 0);
      const itensComCot = orc.itens.filter((item) => {
        const cot = cotMap.get(`${item.id}|${of.fornecedor_id}`);
        return cot && !cot.sem_cotacao_vigente;
      }).length;
      return { nome: of.fornecedor.nome, regime: of.fornecedor.regime_tributario, total, itensComCot };
    })
    .sort((a, b) => a.total - b.total);

  const body = ranking.map((r, idx) => [
    String(idx + 1),
    r.nome,
    r.regime.replace(/_/g, ' '),
    `${r.itensComCot} / ${orc.itens.length}`,
    formatBRL(r.total),
    idx === 0 ? '★ Melhor preço' : '',
  ]);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  doc.text(
    `★ = melhor preço total  |  Itens s/ cotação excluídos do total`,
    MARGIN_LEFT,
    y,
  );
  doc.setTextColor(0);
  y += 14;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Fornecedor', 'Regime tributário', 'Itens cotados', 'Total', 'Destaque']],
    body,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 40, 40] as [number, number, number], textColor: 255 },
    didParseCell: (data) => {
      if (data.row.index === 0 && data.section === 'body') {
        data.cell.styles.fillColor = [220, 255, 220];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT, bottom: MARGIN_BOTTOM },
    tableWidth: pageWidth - MARGIN_LEFT - MARGIN_RIGHT,
    didDrawPage: () => drawHeaderFooter(doc, generatedAt),
  });
}

export function exportOrcamentoPdf(
  orc: OrcamentoDetalhe,
  projeto: { numero: string; descricao: string },
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const generatedAt = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });

  // Página 1: Capa
  renderCoverPage(doc, orc, projeto, generatedAt);

  // Páginas seguintes: Matriz comparativa (máx 4 fornecedores por página)
  const CHUNK_SIZE = 4;
  const chunks: OrcamentoDetalhe['fornecedores'][] = [];
  for (let i = 0; i < orc.fornecedores.length; i += CHUNK_SIZE) {
    chunks.push(orc.fornecedores.slice(i, i + CHUNK_SIZE));
  }
  if (chunks.length === 0) chunks.push([]);

  for (let ci = 0; ci < chunks.length; ci++) {
    doc.addPage();
    renderMatrizPage(doc, orc, generatedAt, chunks[ci], ci, chunks.length);
  }

  // Última seção: Ranking
  doc.addPage();
  renderRankingPage(doc, orc, generatedAt);

  if (
    typeof (doc as unknown as { putTotalPages?: (s: string) => void }).putTotalPages === 'function'
  ) {
    (doc as unknown as { putTotalPages: (s: string) => void }).putTotalPages(TOTAL_PAGES);
  }

  const blob = doc.output('blob');
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href      = url;
  a.target    = '_blank';
  a.rel       = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

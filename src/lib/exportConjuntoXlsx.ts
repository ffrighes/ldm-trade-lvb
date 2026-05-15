import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { BomRoot, BomTreeNode, BomVersion } from '@/types/bom';
import { type ExportChildData, type ItemRow, collectAllItems } from '@/lib/exportConjuntoPdf';

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

// ---- Child flattening for cover sheet ----

function flattenChildrenForXlsx(
  children: ExportChildData[],
  depth: number,
): Array<{ indent: number; label: string }> {
  const out: Array<{ indent: number; label: string }> = [];
  for (const c of children) {
    const versionLbl = `v${c.version.version_number}, ${c.version.status}`;
    out.push({
      indent: depth,
      label: `${c.root.codigo} — ${c.root.name}  (${versionLbl})`,
    });
    out.push(...flattenChildrenForXlsx(c.children, depth + 1));
  }
  return out;
}

// ---- Sheet builders ----

function buildCoverSheet(
  root: BomRoot,
  version: BomVersion,
  childConjuntos: ExportChildData[],
  projeto?: { numero: string; descricao: string },
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
    ['LISTA DE MATERIAIS', ''],       // row 1 — merged A1:B1
    ['', ''],                         // row 2 — blank
    ['Lista', `${root.codigo} — ${root.name}`],
    ['Projeto', projetoLabel],
    ['Revisão', versionLabel],
    ['Status', version.status],
    ['Data de Criação', createdAt],
    ['Data de Liberação', releasedAt],
    ['', ''],                         // row 9 — blank
    ['Conjuntos Filhos', ''],         // row 10
  ];

  const flat = flattenChildrenForXlsx(childConjuntos, 0);
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
  tree: BomTreeNode,
  matMap: Map<string, MaterialLite>,
  childConjuntos: ExportChildData[],
): XLSX.WorkSheet {
  const allItems = collectAllItems(tree, matMap, childConjuntos);
  const consolidated = consolidateItemsForXlsx(allItems);

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
): void {
  const wb = XLSX.utils.book_new();

  const coverSheet = buildCoverSheet(root, version, childConjuntos, projeto);
  XLSX.utils.book_append_sheet(wb, coverSheet, 'Folha de Rosto');

  const consolidatedSheet = buildConsolidatedSheet(tree, matMap, childConjuntos);
  XLSX.utils.book_append_sheet(wb, consolidatedSheet, 'Lista Consolidada');

  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_');
  const filename = `${safe(root.codigo)}_${safe(root.name)}_v${version.version_number}.xlsx`;

  XLSX.writeFile(wb, filename);
}

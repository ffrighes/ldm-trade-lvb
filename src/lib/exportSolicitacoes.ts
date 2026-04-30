import * as XLSX from 'xlsx';
import { format } from 'date-fns';

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
  custo_unitario: number;
  custo_total: number;
  notas?: string | null;
}

interface SolicitacaoLite {
  id: string;
  numero: string;
  projeto_id: string;
  status: string;
  motivo: string;
  data_solicitacao: string;
  revisao: string;
  erp: string;
  notas: string;
  created_at?: string;
  solicitacao_itens?: SolicitacaoItemLite[];
}

function projectLabel(projects: ProjectLite[], id: string): string {
  const p = projects.find((x) => x.id === id);
  return p ? `${p.numero} - ${p.descricao}` : '';
}

function timestampSuffix(): string {
  return format(new Date(), 'yyyyMMdd_HHmm');
}

export function exportSolicitacoesToXlsx(
  solicitacoes: SolicitacaoLite[],
  projects: ProjectLite[],
  filename = `solicitacoes_${timestampSuffix()}.xlsx`,
) {
  const summaryRows = solicitacoes.map((s) => {
    const itens = s.solicitacao_itens ?? [];
    const custoTotal = itens.reduce((acc, i) => acc + Number(i.custo_total ?? 0), 0);
    return {
      'Nº': s.numero,
      Projeto: projectLabel(projects, s.projeto_id),
      Status: s.status,
      Motivo: s.motivo,
      Data: s.data_solicitacao,
      Revisão: s.revisao,
      ERP: s.erp,
      Itens: itens.length,
      'Custo Total': Number(custoTotal.toFixed(2)),
      Notas: s.notas,
    };
  });

  const itemRows: Record<string, string | number>[] = [];
  for (const s of solicitacoes) {
    const projeto = projectLabel(projects, s.projeto_id);
    for (const i of s.solicitacao_itens ?? []) {
      itemRows.push({
        'Solicitação': s.numero,
        Projeto: projeto,
        Status: s.status,
        Descrição: i.descricao,
        Bitola: i.bitola,
        Unidade: i.unidade,
        Quantidade: Number(i.quantidade ?? 0),
        'Custo Unitário': Number(Number(i.custo_unitario ?? 0).toFixed(2)),
        'Custo Total': Number(Number(i.custo_total ?? 0).toFixed(2)),
        Notas: i.notas ?? '',
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Solicitações');

  if (itemRows.length > 0) {
    const wsItens = XLSX.utils.json_to_sheet(itemRows);
    XLSX.utils.book_append_sheet(wb, wsItens, 'Itens');
  }

  XLSX.writeFile(wb, filename);
}

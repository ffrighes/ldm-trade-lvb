export interface Project {
  id: string;
  numero: string;
  descricao: string;
  dataCriacao: string;
}

export interface MaterialItem {
  id: string;
  descricao: string;
  bitola: string;
  unidade: string;
  custo: number;
}

export interface SolicitacaoItem {
  id: string;
  materialId: string;
  descricao: string;
  bitola: string;
  quantidade: number;
  unidade: string;
  custoUnitario: number;
  custoTotal: number;
}

export type SolicitacaoStatus = 'Aberta' | 'Aprovada' | 'Finalizada';

export interface Solicitacao {
  id: string;
  numero: string;
  projetoId: string;
  status: SolicitacaoStatus;
  dataSolicitacao: string;
  desenho?: string;
  revisao: string;
  erp: string;
  notas: string;
  itens: SolicitacaoItem[];
}

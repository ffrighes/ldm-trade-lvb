import { useNavigate } from 'react-router-dom';
import { Eye, FileText, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatBRL } from '@/lib/formatCurrency';
import { usePermissions } from '@/hooks/usePermissions';

type SolicitacaoStatus = 'Aberta' | 'Aprovada' | 'Finalizada' | 'Material Comprado' | 'Material enviado para Obra' | 'Cancelada';

const statusColors: Record<SolicitacaoStatus, string> = {
  Aberta: 'bg-warning text-warning-foreground',
  Aprovada: 'bg-info text-info-foreground',
  Finalizada: 'bg-success text-success-foreground',
  'Material Comprado': 'bg-primary/20 text-primary',
  'Material enviado para Obra': 'bg-accent text-accent-foreground',
  Cancelada: 'bg-destructive/20 text-destructive',
};

interface Row {
  id: string;
  numero: string;
  projeto_id: string;
  status: string;
  motivo: string;
  data_solicitacao: string;
  erp: string;
  desenho?: string | null;
  solicitacao_itens?: Array<{ id: string; material_id?: string | null; quantidade: number; custo_unitario: number }>;
}

interface Props {
  rows: Row[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  getProjetoNome: (id: string) => string;
  calcCustoAtualizado: (itens: Row['solicitacao_itens']) => number;
  onRefreshCosts: (id: string, itens: Row['solicitacao_itens']) => void;
  onDelete: (id: string, numero: string) => void;
  onView: (id: string) => void;
  refreshingCosts: boolean;
}

export function SolicitacoesMobileCards({
  rows,
  isLoading,
  selectedIds,
  onToggleSelect,
  getProjetoNome,
  calcCustoAtualizado,
  onRefreshCosts,
  onDelete,
  onView,
  refreshingCosts,
}: Props) {
  const { canDeleteSolicitacao } = usePermissions();

  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />Carregando…
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">Nenhuma solicitação encontrada</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((s) => {
        const itens = s.solicitacao_itens ?? [];
        const custo = calcCustoAtualizado(itens);
        const checked = selectedIds.has(s.id);
        return (
          <Card key={s.id} className={checked ? 'border-primary' : ''}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onToggleSelect(s.id)}
                  aria-label={`Selecionar solicitação ${s.numero}`}
                  className="mt-1"
                />
                <button
                  type="button"
                  className="flex-1 text-left min-w-0"
                  onClick={() => navigate(`/solicitacoes/${s.id}`)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{s.numero}</span>
                    <Badge className={statusColors[s.status as SolicitacaoStatus] || ''}>{s.status}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">{getProjetoNome(s.projeto_id)}</div>
                </button>
              </div>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Motivo</dt>
                  <dd className="truncate">{s.motivo}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Data</dt>
                  <dd>{s.data_solicitacao}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Itens</dt>
                  <dd>{itens.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">ERP</dt>
                  <dd className="font-mono">{s.erp || '-'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Custo Total</dt>
                  <dd className="font-mono font-medium">{formatBRL(custo)}</dd>
                </div>
              </dl>

              <div className="flex gap-1 pt-1 border-t">
                <Button variant="ghost" size="sm" onClick={() => navigate(`/solicitacoes/${s.id}`)} aria-label="Abrir solicitação">
                  <Eye className="h-4 w-4 mr-1" />Abrir
                </Button>
                {s.desenho && (
                  <a href={s.desenho} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" asChild aria-label="Ver desenho">
                      <span><FileText className="h-4 w-4 mr-1 text-primary" />Desenho</span>
                    </Button>
                  </a>
                )}
                {s.status === 'Aberta' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Atualizar custos"
                    disabled={refreshingCosts}
                    onClick={() => onRefreshCosts(s.id, itens)}
                  >
                    <RefreshCw className="h-4 w-4 mr-1 text-primary" />Custos
                  </Button>
                )}
                {canDeleteSolicitacao(s.status) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive ml-auto" aria-label="Excluir solicitação">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir solicitação {s.numero}?</AlertDialogTitle>
                        <AlertDialogDescription>Esta ação excluirá a solicitação e todos os seus itens. Não pode ser desfeita.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(s.id, s.numero)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

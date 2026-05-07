import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSolicitacao, useProjects } from '@/hooks/useSupabaseData';
import { formatBRL } from '@/lib/formatCurrency';

type SolicitacaoStatus = 'Aberta' | 'Aprovada' | 'Finalizada' | 'Material Comprado' | 'Material enviado para Obra' | 'Cancelada';

const statusColors: Record<SolicitacaoStatus, string> = {
  Aberta: 'bg-warning text-warning-foreground',
  Aprovada: 'bg-info text-info-foreground',
  Finalizada: 'bg-success text-success-foreground',
  'Material Comprado': 'bg-primary/20 text-primary',
  'Material enviado para Obra': 'bg-accent text-accent-foreground',
  Cancelada: 'bg-destructive/20 text-destructive',
};

interface Props {
  solicitacaoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SolicitacaoDetailsDialog({ solicitacaoId, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useSolicitacao(solicitacaoId ?? undefined);
  const { data: projects = [] } = useProjects();

  const projeto = data ? projects.find((p) => p.id === data.projeto_id) : null;
  const projetoLabel = projeto ? `${projeto.numero} - ${projeto.descricao}` : '—';
  const itens = data?.solicitacao_itens ?? [];
  const total = itens.reduce((acc: number, i: any) => acc + (i.custo_total ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl w-[calc(100vw-2rem)] p-0 gap-0 max-h-[90vh] flex flex-col"
        aria-labelledby="solicitacao-details-title"
      >
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle id="solicitacao-details-title" className="flex items-center gap-3 flex-wrap">
            <span className="font-mono">{data?.numero ?? 'Solicitação'}</span>
            {data?.status && (
              <Badge className={statusColors[data.status as SolicitacaoStatus] || ''}>
                {data.status}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>Detalhes da solicitação</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-32 w-full" />
              </div>
            )}

            {isError && !isLoading && (
              <div className="text-destructive text-sm">
                Erro ao carregar solicitação: {error instanceof Error ? error.message : 'tente novamente.'}
              </div>
            )}

            {!isLoading && !isError && data && (
              <>
                <section>
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                    Informações Gerais
                  </h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Projeto</dt>
                      <dd className="font-medium">{projetoLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Data da Solicitação</dt>
                      <dd className="font-medium">{data.data_solicitacao || '—'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">Motivo</dt>
                      <dd className="font-medium whitespace-pre-wrap">{data.motivo || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Revisão</dt>
                      <dd className="font-medium">{data.revisao || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">ERP</dt>
                      <dd className="font-mono font-medium">{data.erp || '—'}</dd>
                    </div>
                    {data.notas && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-muted-foreground">Notas</dt>
                        <dd className="whitespace-pre-wrap">{data.notas}</dd>
                      </div>
                    )}
                    {data.desenho && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-muted-foreground">Desenho</dt>
                        <dd>
                          <a
                            href={data.desenho}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <FileText className="h-4 w-4" /> Abrir desenho
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>

                <section>
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                    Itens ({itens.length})
                  </h3>
                  {itens.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum item.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>TAG</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Bitola</TableHead>
                            <TableHead className="text-center">Qtd</TableHead>
                            <TableHead>Un.</TableHead>
                            <TableHead className="text-right">Custo Unit.</TableHead>
                            <TableHead className="text-right">Custo Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itens.map((item: any, idx: number) => (
                            <TableRow key={item.id}>
                              <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell>{item.tag || '-'}</TableCell>
                              <TableCell>
                                <div>{item.descricao}</div>
                                {item.notas && (
                                  <div className="text-xs text-muted-foreground mt-0.5">{item.notas}</div>
                                )}
                              </TableCell>
                              <TableCell>{item.bitola || '—'}</TableCell>
                              <TableCell className="text-center">{item.quantidade}</TableCell>
                              <TableCell>{item.unidade}</TableCell>
                              <TableCell className="text-right font-mono">{formatBRL(item.custo_unitario ?? 0)}</TableCell>
                              <TableCell className="text-right font-mono">{formatBRL(item.custo_total ?? 0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  <div className="flex justify-end mt-3 text-sm">
                    <span className="text-muted-foreground mr-2">Custo Total:</span>
                    <span className="font-mono font-semibold">{formatBRL(total)}</span>
                  </div>
                </section>
              </>
            )}
          </div>
        </ScrollArea>

        {data && (
          <div className="flex justify-end gap-2 p-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                navigate(`/solicitacoes/${data.id}`);
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir página completa
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

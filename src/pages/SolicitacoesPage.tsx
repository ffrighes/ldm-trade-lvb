import { useEffect, useMemo, useState } from 'react';
import {
  useSolicitacoesPaginated,
  useSolicitacoesKpis,
  useProjects,
  useMaterials,
  useDeleteSolicitacao,
  useUpdateSolicitacaoItemCosts,
  useBulkUpdateSolicitacaoStatus,
  useBulkDeleteSolicitacoes,
} from '@/hooks/useSupabaseData';
import { useSolicitacoesFilters, ALL_STATUSES, type StatusValue, type SolicitacoesFiltersState } from '@/hooks/useSolicitacoesFilters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, Eye, Trash2, FileText, RefreshCw, Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { formatBRL } from '@/lib/formatCurrency';
import { usePermissions } from '@/hooks/usePermissions';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { DateRangeFilter } from '@/components/solicitacoes/DateRangeFilter';
import { SortableHeader } from '@/components/solicitacoes/SortableHeader';
import { SolicitacoesPagination } from '@/components/solicitacoes/SolicitacoesPagination';
import { KpiCards } from '@/components/solicitacoes/KpiCards';
import { SavedViewsMenu } from '@/components/solicitacoes/SavedViewsMenu';
import { BulkActionsBar } from '@/components/solicitacoes/BulkActionsBar';
import { SolicitacoesMobileCards } from '@/components/solicitacoes/SolicitacoesMobileCards';
import { exportSolicitacoesToXlsx } from '@/lib/exportSolicitacoes';

type SolicitacaoStatus = 'Aberta' | 'Aprovada' | 'Finalizada' | 'Material Comprado' | 'Material enviado para Obra' | 'Cancelada';

const statusColors: Record<SolicitacaoStatus, string> = {
  Aberta: 'bg-warning text-warning-foreground',
  Aprovada: 'bg-info text-info-foreground',
  Finalizada: 'bg-success text-success-foreground',
  'Material Comprado': 'bg-primary/20 text-primary',
  'Material enviado para Obra': 'bg-accent text-accent-foreground',
  Cancelada: 'bg-destructive/20 text-destructive',
};

const PRESET_STATUSES = {
  abertas: ALL_STATUSES.filter((s) => s !== 'Finalizada' && s !== 'Cancelada') as unknown as StatusValue[],
  finalizadas: ['Finalizada'] as StatusValue[],
};

export default function SolicitacoesPage() {
  const { state, update, pageSizes } = useSolicitacoesFilters();
  const [searchInput, setSearchInput] = useState(state.search);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (searchInput === state.search) return;
    const t = setTimeout(() => update({ search: searchInput }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  useEffect(() => {
    if (state.search !== searchInput) setSearchInput(state.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.search]);

  const queryParams = useMemo(() => {
    const presetStatuses =
      state.preset === 'abertas'
        ? PRESET_STATUSES.abertas
        : state.preset === 'finalizadas'
          ? PRESET_STATUSES.finalizadas
          : [];
    const effectiveStatuses = state.status.length > 0 ? state.status : presetStatuses;
    return {
      page: state.page,
      pageSize: state.pageSize,
      sortBy: state.sortBy,
      sortDir: state.sortDir,
      search: state.search,
      status: effectiveStatuses,
      projetoId: state.projetoId || undefined,
      dateFrom: state.dateFrom || undefined,
      dateTo: state.dateTo || undefined,
    };
  }, [state]);

  const { data, isLoading, isFetching } = useSolicitacoesPaginated(queryParams);
  const { data: kpis, isLoading: kpisLoading } = useSolicitacoesKpis({
    search: queryParams.search,
    status: queryParams.status,
    projetoId: queryParams.projetoId,
    dateFrom: queryParams.dateFrom,
    dateTo: queryParams.dateTo,
  });
  const { data: projects = [] } = useProjects();
  const { data: materials = [] } = useMaterials();
  const deleteSolicitacao = useDeleteSolicitacao();
  const updateItemCosts = useUpdateSolicitacaoItemCosts();
  const bulkUpdateStatus = useBulkUpdateSolicitacaoStatus();
  const bulkDelete = useBulkDeleteSolicitacoes();
  const navigate = useNavigate();
  const { canCreateSolicitacao, canDeleteSolicitacao } = usePermissions();
  const isMobile = useIsMobile();

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const total = data?.total ?? 0;

  // Drop selections that no longer match the current page (page change, filter change, etc).
  useEffect(() => {
    setSelectedIds((prev) => {
      const visible = new Set(rows.map((r) => r.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)).map((r) => ({ id: r.id, status: r.status })),
    [rows, selectedIds],
  );

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someOnPageSelected = rows.some((r) => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allOnPageSelected) {
        const next = new Set(prev);
        rows.forEach((r) => next.delete(r.id));
        return next;
      }
      const next = new Set(prev);
      rows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearSelection = () => setSelectedIds(new Set());

  const getProjetoNome = (id: string) => {
    const p = projects.find((x) => x.id === id);
    return p ? `${p.numero} - ${p.descricao}` : 'N/A';
  };

  const calcCustoAtualizado = (itens: any[] | undefined) =>
    (itens ?? []).reduce((acc, item) => {
      const mat = item.material_id ? materials.find((m: any) => m.id === item.material_id) : null;
      const custo = mat ? (mat.custo ?? 0) : (item.custo_unitario ?? 0);
      return acc + item.quantidade * custo;
    }, 0);

  const refreshCostsFor = async (itens: any[]) => {
    const updates = itens
      .filter((item: any) => item.material_id)
      .map((item: any) => {
        const mat = materials.find((m: any) => m.id === item.material_id);
        const custo_unitario = mat?.custo ?? 0;
        return { id: item.id, custo_unitario, custo_total: item.quantidade * custo_unitario };
      });
    await updateItemCosts.mutateAsync(updates);
  };

  const handleAtualizarCustos = async (e: React.MouseEvent | undefined, _id: string, itens: any[]) => {
    e?.stopPropagation();
    try {
      await refreshCostsFor(itens);
      toast.success('Custos atualizados com sucesso');
    } catch {
      toast.error('Erro ao atualizar custos');
    }
  };

  const handleSort = (field: typeof state.sortBy) => {
    if (state.sortBy === field) {
      update({ sortDir: state.sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      update({ sortBy: field, sortDir: 'asc' });
    }
  };

  // Bulk handlers ---------------------------------------------------

  const handleBulkChangeStatus = async (status: string) => {
    const ids = [...selectedIds];
    try {
      await bulkUpdateStatus.mutateAsync({ ids, status });
      toast.success(`${ids.length} solicitação(ões) atualizadas para "${status}"`);
      clearSelection();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar status');
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    try {
      await bulkDelete.mutateAsync(ids);
      toast.success(`${ids.length} solicitação(ões) excluída(s)`);
      clearSelection();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir');
    }
  };

  const handleBulkRefreshCosts = async () => {
    const idsToRefresh = rows.filter((r) => selectedIds.has(r.id) && r.status === 'Aberta');
    if (idsToRefresh.length === 0) {
      toast.info('Nenhuma solicitação em "Aberta" para atualizar.');
      return;
    }
    try {
      for (const r of idsToRefresh) {
        await refreshCostsFor(r.solicitacao_itens ?? []);
      }
      toast.success(`Custos atualizados em ${idsToRefresh.length} solicitação(ões)`);
    } catch {
      toast.error('Erro ao atualizar custos em lote');
    }
  };

  const handleBulkExport = async () => {
    if (selectedIds.size === 0) return;
    setIsExporting(true);
    try {
      const ids = [...selectedIds];
      const { data: full, error } = await supabase
        .from('solicitacoes')
        .select('*, solicitacao_itens(*)')
        .in('id', ids);
      if (error) throw error;
      exportSolicitacoesToXlsx(full ?? [], projects);
      toast.success(`Exportadas ${ids.length} solicitação(ões)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao exportar');
    } finally {
      setIsExporting(false);
    }
  };

  // Saved views -----------------------------------------------------

  const savableFilters: Partial<SolicitacoesFiltersState> = useMemo(() => ({
    search: state.search,
    status: state.status,
    projetoId: state.projetoId,
    dateFrom: state.dateFrom,
    dateTo: state.dateTo,
    preset: state.preset,
  }), [state.search, state.status, state.projetoId, state.dateFrom, state.dateTo, state.preset]);

  const applySavedView = (filters: Record<string, unknown>) => {
    update({
      search: typeof filters.search === 'string' ? filters.search : '',
      status: Array.isArray(filters.status) ? (filters.status as StatusValue[]) : [],
      projetoId: typeof filters.projetoId === 'string' ? filters.projetoId : '',
      dateFrom: typeof filters.dateFrom === 'string' ? filters.dateFrom : '',
      dateTo: typeof filters.dateTo === 'string' ? filters.dateTo : '',
      preset: filters.preset === 'abertas' || filters.preset === 'finalizadas' ? filters.preset : 'all',
    });
  };

  const statusFilterValue = state.status.length === 1 ? state.status[0] : 'all';
  const onStatusFilterChange = (value: string) => {
    if (value === 'all') update({ status: [], preset: 'all' });
    else update({ status: [value as StatusValue], preset: 'all' });
  };

  const isMutating = bulkUpdateStatus.isPending || bulkDelete.isPending || updateItemCosts.isPending;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Solicitações</h1>
        <div className="flex items-center gap-2">
          <SavedViewsMenu currentFilters={savableFilters as Record<string, unknown>} onApply={applySavedView} />
          {canCreateSolicitacao && (
            <Button onClick={() => navigate('/solicitacoes/nova')}><Plus className="h-4 w-4 mr-2" />Criar Nova Solicitação</Button>
          )}
        </div>
      </div>

      <KpiCards kpis={kpis} isLoading={kpisLoading} />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="Buscar por número, motivo, ERP ou projeto..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  aria-label="Buscar solicitações"
                />
              </div>
              <Select value={statusFilterValue} onValueChange={onStatusFilterChange}>
                <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por status"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={state.projetoId || 'all'} onValueChange={(v) => update({ projetoId: v === 'all' ? '' : v })}>
                <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por projeto"><SelectValue placeholder="Projeto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Projetos</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.numero} - {p.descricao}</SelectItem>)}
                </SelectContent>
              </Select>
              <DateRangeFilter
                from={state.dateFrom}
                to={state.dateTo}
                onChange={({ from, to }) => update({ dateFrom: from, dateTo: to })}
              />
            </div>
            <div className="flex gap-2 items-center">
              <Button variant={state.preset === 'all' && state.status.length === 0 ? 'default' : 'outline'} size="sm" onClick={() => update({ preset: 'all', status: [] })}>Todas</Button>
              <Button variant={state.preset === 'abertas' ? 'default' : 'outline'} size="sm" onClick={() => update({ preset: 'abertas', status: [] })}>Abertas</Button>
              <Button variant={state.preset === 'finalizadas' ? 'default' : 'outline'} size="sm" onClick={() => update({ preset: 'finalizadas', status: [] })}>Finalizadas</Button>
              {isFetching && !isLoading && (
                <span className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Atualizando…
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <BulkActionsBar
            selected={selectedRows}
            isExporting={isExporting}
            isMutating={isMutating}
            onClear={clearSelection}
            onChangeStatus={handleBulkChangeStatus}
            onDelete={handleBulkDelete}
            onExport={handleBulkExport}
            onRefreshCosts={handleBulkRefreshCosts}
          />

          {isMobile ? (
            <SolicitacoesMobileCards
              rows={rows}
              isLoading={isLoading}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              getProjetoNome={getProjetoNome}
              calcCustoAtualizado={calcCustoAtualizado}
              onRefreshCosts={(id, itens) => handleAtualizarCustos(undefined, id, itens ?? [])}
              onDelete={(id, numero) => { deleteSolicitacao.mutate(id); toast.success(`Solicitação ${numero} excluída`); }}
              refreshingCosts={updateItemCosts.isPending}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Selecionar todas as solicitações da página"
                      />
                    </TableHead>
                    <SortableHeader field="numero" activeField={state.sortBy} direction={state.sortDir} onSort={handleSort}>Nº</SortableHeader>
                    <TableHead>Projeto</TableHead>
                    <SortableHeader field="status" activeField={state.sortBy} direction={state.sortDir} onSort={handleSort}>Status</SortableHeader>
                    <TableHead>Motivo</TableHead>
                    <SortableHeader field="data_solicitacao" activeField={state.sortBy} direction={state.sortDir} onSort={handleSort}>Data</SortableHeader>
                    <TableHead className="text-center">Itens</TableHead>
                    <SortableHeader field="erp" activeField={state.sortBy} direction={state.sortDir} onSort={handleSort}>ERP</SortableHeader>
                    <TableHead className="text-right">Custo Total</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />Carregando…
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhuma solicitação encontrada</TableCell></TableRow>
                  ) : rows.map((s) => {
                    const itens = s.solicitacao_itens || [];
                    const custoAtualizado = calcCustoAtualizado(itens);
                    const checked = selectedIds.has(s.id);
                    return (
                      <TableRow
                        key={s.id}
                        className={`cursor-pointer hover:bg-muted/50 ${checked ? 'bg-muted/30' : ''}`}
                        onClick={() => navigate(`/solicitacoes/${s.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleSelect(s.id)}
                            aria-label={`Selecionar solicitação ${s.numero}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono font-medium">{s.numero}</TableCell>
                        <TableCell className="max-w-xs truncate">{getProjetoNome(s.projeto_id)}</TableCell>
                        <TableCell><Badge className={statusColors[s.status as SolicitacaoStatus] || ''}>{s.status}</Badge></TableCell>
                        <TableCell className="max-w-xs truncate">{s.motivo}</TableCell>
                        <TableCell className="text-muted-foreground">{s.data_solicitacao}</TableCell>
                        <TableCell className="text-center">{itens.length}</TableCell>
                        <TableCell className="font-mono">{s.erp || '-'}</TableCell>
                        <TableCell className="text-right font-mono">{formatBRL(custoAtualizado)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" aria-label="Ver solicitação" onClick={(e) => { e.stopPropagation(); navigate(`/solicitacoes/${s.id}`); }}><Eye className="h-4 w-4" /></Button>
                            {s.desenho && (
                              <a href={s.desenho} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Ver desenho">
                                <Button variant="ghost" size="icon" asChild aria-label="Ver desenho">
                                  <span><FileText className="h-4 w-4 text-primary" /></span>
                                </Button>
                              </a>
                            )}
                            {s.status === 'Aberta' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Atualizar custos"
                                title="Atualizar custos"
                                disabled={updateItemCosts.isPending}
                                onClick={(e) => handleAtualizarCustos(e, s.id, itens)}
                              >
                                <RefreshCw className="h-4 w-4 text-primary" />
                              </Button>
                            )}
                            {canDeleteSolicitacao(s.status) && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" aria-label="Excluir solicitação" onClick={(e) => e.stopPropagation()}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir solicitação {s.numero}?</AlertDialogTitle>
                                    <AlertDialogDescription>Esta ação excluirá a solicitação e todos os seus itens. Não pode ser desfeita.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={(e) => { e.stopPropagation(); deleteSolicitacao.mutate(s.id); toast.success('Solicitação excluída'); }}>Excluir</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <SolicitacoesPagination
            page={state.page}
            pageSize={state.pageSize}
            total={total}
            pageSizes={pageSizes}
            onPageChange={(page) => update({ page })}
            onPageSizeChange={(pageSize) => update({ pageSize, page: 0 })}
          />
        </CardContent>
      </Card>
    </div>
  );
}

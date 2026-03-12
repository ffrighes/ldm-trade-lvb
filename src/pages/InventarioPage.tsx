import { useState, useMemo } from 'react';
import { useProjects, useMaterials, useAddInventarioAjuste, useDeleteInventarioItem } from '@/hooks/useSupabaseData';
import { useInventario } from '@/hooks/useInventario';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { formatBRL } from '@/lib/formatCurrency';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface InventarioItem {
  id: string;
  descricao: string;
  bitola: string;
  quantidade: number;
  unidade: string;
  custo_unitario: number;
  custo_total: number;
  solicitacao_numero: string;
  solicitacao_id: string | null;
  tipo: string;
}

interface Origem {
  id: string;
  solicitacao_numero: string;
  quantidade: number;
  custo_unitario: number;
  custo_total: number;
  tipo: string;
}

interface GroupedItem {
  descricao: string;
  bitola: string;
  unidade: string;
  totalQuantidade: number;
  totalCusto: number;
  origens: Origem[];
}

const EMPTY_FORM = {
  descricao: '',
  bitola: '',
  unidade: 'un',
  quantidade: '',
  custo_unitario: '',
};

export default function InventarioPage() {
  const { data: projects } = useProjects();
  const { data: materials } = useMaterials();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const { data: inventario, isLoading } = useInventario(selectedProjectId);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  // Adjustment dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const addAjuste = useAddInventarioAjuste();

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; label: string } | null>(null);
  const deleteItem = useDeleteInventarioItem();

  const selectedProject = projects?.find(p => p.id === selectedProjectId);

  const grouped = useMemo(() => {
    if (!inventario) return [];
    const map = new Map<string, GroupedItem>();
    for (const item of inventario as InventarioItem[]) {
      const key = `${item.descricao}||${item.bitola}||${item.unidade}`;
      const existing = map.get(key);
      const origem: Origem = {
        id: item.id,
        solicitacao_numero: item.tipo === 'ajuste' ? 'AJUSTE' : item.solicitacao_numero,
        quantidade: Number(item.quantidade),
        custo_unitario: Number(item.custo_unitario),
        custo_total: Number(item.custo_total),
        tipo: item.tipo,
      };
      if (existing) {
        existing.totalQuantidade += Number(item.quantidade);
        existing.totalCusto += Number(item.custo_total);
        existing.origens.push(origem);
      } else {
        map.set(key, {
          descricao: item.descricao,
          bitola: item.bitola,
          unidade: item.unidade,
          totalQuantidade: Number(item.quantidade),
          totalCusto: Number(item.custo_total),
          origens: [origem],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.descricao.localeCompare(b.descricao));
  }, [inventario]);

  const totalItems = grouped.length;
  const totalCost = grouped.reduce((sum, g) => sum + g.totalCusto, 0);

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Autofill unit when description+bitola matches a known material
  const handleDescricaoChange = (value: string) => {
    setForm(f => {
      const match = materials?.find(m => m.descricao === value && (!f.bitola || m.bitola === f.bitola));
      return {
        ...f,
        descricao: value,
        bitola: match ? match.bitola : f.bitola,
        unidade: match ? match.unidade : f.unidade,
        custo_unitario: match ? String(match.custo) : f.custo_unitario,
      };
    });
  };

  const handleBitolaChange = (value: string) => {
    setForm(f => {
      const match = materials?.find(m => m.descricao === f.descricao && m.bitola === value);
      return {
        ...f,
        bitola: value,
        unidade: match ? match.unidade : f.unidade,
        custo_unitario: match ? String(match.custo) : f.custo_unitario,
      };
    });
  };

  const handleSubmit = async () => {
    const quantidade = Number(form.quantidade);
    const custo_unitario = Number(form.custo_unitario);
    if (!form.descricao || quantidade <= 0) return;
    await addAjuste.mutateAsync({
      projeto_id: selectedProjectId,
      descricao: form.descricao.trim(),
      bitola: form.bitola.trim(),
      unidade: form.unidade.trim() || 'un',
      quantidade,
      custo_unitario,
      custo_total: quantidade * custo_unitario,
    });
    setForm(EMPTY_FORM);
    setDialogOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteItem.mutateAsync({ ids: deleteTarget.ids, projeto_id: selectedProjectId });
    setDeleteTarget(null);
  };

  // Unique description options from materials for datalist
  const materialDescricoes = useMemo(
    () => [...new Set(materials?.map(m => m.descricao) ?? [])].sort(),
    [materials],
  );

  const bitolaOptions = useMemo(
    () => [...new Set(materials?.filter(m => !form.descricao || m.descricao === form.descricao).map(m => m.bitola) ?? [])].sort(),
    [materials, form.descricao],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Inventário</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Inventário de materiais por projeto — itens compilados por descrição.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-80">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um projeto" />
            </SelectTrigger>
            <SelectContent>
              {projects?.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.numero} — {p.descricao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProjectId && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Ajuste de Estoque
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Ajuste de Estoque</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                <div className="grid gap-1.5">
                  <Label>Descrição</Label>
                  <Input
                    list="desc-options"
                    value={form.descricao}
                    onChange={e => handleDescricaoChange(e.target.value)}
                    placeholder="Ex: TUBO RET"
                  />
                  <datalist id="desc-options">
                    {materialDescricoes.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Bitola</Label>
                    <Input
                      list="bitola-options"
                      value={form.bitola}
                      onChange={e => handleBitolaChange(e.target.value)}
                      placeholder="Ex: 100x100x4"
                    />
                    <datalist id="bitola-options">
                      {bitolaOptions.map(b => <option key={b} value={b} />)}
                    </datalist>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Unidade</Label>
                    <Input
                      value={form.unidade}
                      onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}
                      placeholder="un"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={form.quantidade}
                      onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Custo Unitário (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.custo_unitario}
                      onChange={e => setForm(f => ({ ...f, custo_unitario: e.target.value }))}
                    />
                  </div>
                </div>

                {form.quantidade && form.custo_unitario && (
                  <p className="text-sm text-muted-foreground">
                    Custo total: <span className="font-medium text-foreground">{formatBRL(Number(form.quantidade) * Number(form.custo_unitario))}</span>
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!form.descricao || !form.quantidade || Number(form.quantidade) <= 0 || addAjuste.isPending}
                >
                  {addAjuste.isPending ? 'Salvando...' : 'Registrar Ajuste'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {selectedProjectId && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Projeto</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{selectedProject?.numero}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Materiais Distintos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{totalItems}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Custo Total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{formatBRL(totalCost)}</p>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando inventário...</p>
          ) : totalItems === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">Nenhum item no inventário deste projeto.</p>
              <p className="text-xs mt-1">Itens são adicionados ao finalizar solicitações ou por ajuste manual.</p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Bitola</TableHead>
                      <TableHead className="text-right">Qtd Total</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                      <TableHead>Origens</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grouped.map(group => {
                      const key = `${group.descricao}||${group.bitola}||${group.unidade}`;
                      const isOpen = openGroups.has(key);
                      const hasMultiple = group.origens.length > 1;
                      const allIds = group.origens.map(o => o.id);

                      return (
                        <Collapsible key={key} open={isOpen} onOpenChange={() => toggleGroup(key)} asChild>
                          <>
                            <CollapsibleTrigger asChild>
                              <TableRow className={hasMultiple ? 'cursor-pointer hover:bg-muted/50' : 'hover:bg-muted/50'}>
                                <TableCell className="w-8 px-2">
                                  {hasMultiple && (
                                    isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">{group.descricao}</TableCell>
                                <TableCell>{group.bitola}</TableCell>
                                <TableCell className="text-right font-semibold">{group.totalQuantidade}</TableCell>
                                <TableCell>{group.unidade}</TableCell>
                                <TableCell className="text-right font-semibold">{formatBRL(group.totalCusto)}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {group.origens.map((o, i) => (
                                      <Badge
                                        key={i}
                                        variant={o.tipo === 'ajuste' ? 'secondary' : 'outline'}
                                        className="text-xs"
                                      >
                                        {o.solicitacao_numero}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="w-10 px-2" onClick={e => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={e => {
                                      e.stopPropagation();
                                      setDeleteTarget({
                                        ids: allIds,
                                        label: `${group.descricao}${group.bitola ? ` (${group.bitola})` : ''}`,
                                      });
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            </CollapsibleTrigger>
                            <CollapsibleContent asChild>
                              <>
                                {isOpen && group.origens.map((o, i) => (
                                  <TableRow key={i} className="bg-muted/30">
                                    <TableCell></TableCell>
                                    <TableCell className="pl-8 text-muted-foreground text-sm">↳ {o.solicitacao_numero}</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className="text-right text-sm">{o.quantidade}</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className="text-right text-sm">{formatBRL(o.custo_total)}</TableCell>
                                    <TableCell>
                                      <Badge variant={o.tipo === 'ajuste' ? 'secondary' : 'outline'} className="text-xs">
                                        {o.solicitacao_numero}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="w-10 px-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                        onClick={() => setDeleteTarget({
                                          ids: [o.id],
                                          label: `${group.descricao} — ${o.solicitacao_numero}`,
                                        })}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover do inventário?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  O{deleteTarget.ids.length > 1 ? 's' : ''} registro{deleteTarget.ids.length > 1 ? 's' : ''} de{' '}
                  <span className="font-medium text-foreground">{deleteTarget.label}</span>{' '}
                  {deleteTarget.ids.length > 1 ? 'serão removidos' : 'será removido'} permanentemente do inventário.
                  Esta ação não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteItem.isPending ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

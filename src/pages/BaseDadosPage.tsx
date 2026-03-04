import { useState, useMemo } from 'react';
import { useMaterials, useAddMaterial, useUpdateMaterial, useDeleteMaterial } from '@/hooks/useSupabaseData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatBRL, parseBRL } from '@/lib/formatCurrency';
import { usePermissions } from '@/hooks/usePermissions';

export default function BaseDadosPage() {
  const { data: materials = [] } = useMaterials();
  const addMaterial = useAddMaterial();
  const updateMaterial = useUpdateMaterial();
  const deleteMaterial = useDeleteMaterial();
  const perms = usePermissions();

  const [search, setSearch] = useState('');
  const [descFilter, setDescFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ descricao: '', bitola: '', unidade: 'm', custo: '' });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const descriptions = useMemo(() => [...new Set(materials.map(m => m.descricao))].sort(), [materials]);

  const filtered = useMemo(() => materials.filter(m => {
    if (descFilter !== 'all' && m.descricao !== descFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return m.descricao.toLowerCase().includes(s) || m.bitola.toLowerCase().includes(s);
    }
    return true;
  }), [materials, search, descFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof materials>();
    filtered.forEach(m => {
      const list = map.get(m.descricao) || [];
      list.push(m);
      map.set(m.descricao, list);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const toggleGroup = (desc: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(desc)) next.delete(desc); else next.add(desc);
      return next;
    });
  };

  const expandAll = () => setExpandedGroups(new Set(grouped.map(([d]) => d)));
  const collapseAll = () => setExpandedGroups(new Set());

  const handleSave = async () => {
    const custo = parseBRL(form.custo);
    if (!form.descricao.trim() || !form.bitola.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    try {
      if (editingId) {
        await updateMaterial.mutateAsync({ id: editingId, ...form, custo });
        toast.success('Item atualizado');
      } else {
        await addMaterial.mutateAsync({ ...form, custo });
        toast.success('Item adicionado');
      }
      setOpen(false);
    } catch (e: any) {
      if (e.message?.includes('duplicate') || e.code === '23505') {
        toast.error('Este item já existe na base');
      } else {
        toast.error('Erro ao salvar item');
      }
    }
  };

  const openEdit = (m: typeof materials[0]) => {
    setEditingId(m.id);
    setForm({ descricao: m.descricao, bitola: m.bitola, unidade: m.unidade, custo: m.custo.toString() });
    setOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ descricao: '', bitola: '', unidade: 'm', custo: '' });
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Base de Dados</h1>
        {perms?.canModifyBaseDados && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Item</Button>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Editar Item' : 'Novo Item'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Descrição *</Label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div>
              <Label>Bitola *</Label>
              <Input value={form.bitola} onChange={e => setForm(f => ({ ...f, bitola: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Unidade</Label>
                <Select value={form.unidade} onValueChange={v => setForm(f => ({ ...f, unidade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m">m</SelectItem>
                    <SelectItem value="un">un</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="pç">pç</SelectItem>
                    <SelectItem value="cx">cx</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Custo (R$) *</Label>
                <Input value={form.custo} onChange={e => setForm(f => ({ ...f, custo: e.target.value }))} placeholder="0,00" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSave} disabled={addMaterial.isPending || updateMaterial.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-10" placeholder="Buscar materiais..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={descFilter} onValueChange={setDescFilter}>
              <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Filtrar por tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {descriptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">{grouped.length} tipos · {filtered.length} itens</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={expandAll}>Expandir todos</Button>
              <Button variant="ghost" size="sm" onClick={collapseAll}>Recolher todos</Button>
            </div>
          </div>

          <div className="space-y-2">
            {grouped.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">Nenhum item encontrado</div>
            ) : grouped.map(([descricao, items]) => {
              const isExpanded = expandedGroups.has(descricao);
              return (
                <div key={descricao} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleGroup(descricao)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className="font-medium text-sm flex-1">{descricao}</span>
                    <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">{items.length} bitola{items.length > 1 ? 's' : ''}</span>
                  </button>
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bitola</TableHead>
                            <TableHead>Unidade</TableHead>
                            <TableHead className="text-right">Custo</TableHead>
                            <TableHead className="w-24">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map(m => (
                            <TableRow key={m.id}>
                              <TableCell className="font-mono">{m.bitola}</TableCell>
                              <TableCell>{m.unidade}</TableCell>
                              <TableCell className="text-right font-mono">{formatBRL(m.custo)}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir item?</AlertDialogTitle>
                                        <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => { deleteMaterial.mutate(m.id); toast.success('Item excluído'); }}>Excluir</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

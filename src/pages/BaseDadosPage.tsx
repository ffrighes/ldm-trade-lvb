import { useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { MaterialItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatBRL, parseBRL } from '@/lib/formatCurrency';

const PAGE_SIZE = 20;

export default function BaseDadosPage() {
  const { materials, addMaterial, updateMaterial, deleteMaterial } = useAppStore();
  const [search, setSearch] = useState('');
  const [descFilter, setDescFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialItem | null>(null);
  const [form, setForm] = useState({ descricao: '', bitola: '', unidade: 'm', custo: '' });

  const descriptions = useMemo(() => [...new Set(materials.map(m => m.descricao))].sort(), [materials]);

  const filtered = useMemo(() => materials.filter(m => {
    if (descFilter !== 'all' && m.descricao !== descFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return m.descricao.toLowerCase().includes(s) || m.bitola.toLowerCase().includes(s);
    }
    return true;
  }), [materials, search, descFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSave = () => {
    const custo = parseBRL(form.custo);
    if (!form.descricao.trim() || !form.bitola.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (editing) {
      updateMaterial(editing.id, { ...form, custo });
      toast.success('Item atualizado');
    } else {
      const ok = addMaterial({ ...form, custo });
      if (!ok) { toast.error('Este item já existe na base'); return; }
      toast.success('Item adicionado');
    }
    setOpen(false);
  };

  const openEdit = (m: MaterialItem) => {
    setEditing(m);
    setForm({ descricao: m.descricao, bitola: m.bitola, unidade: m.unidade, custo: m.custo.toString() });
    setOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ descricao: '', bitola: '', unidade: 'm', custo: '' });
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Base de Dados</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Item</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar Item' : 'Novo Item'}</DialogTitle></DialogHeader>
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
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-10" placeholder="Buscar materiais..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
            </div>
            <Select value={descFilter} onValueChange={v => { setDescFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Filtrar por descrição" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as descrições</SelectItem>
                {descriptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-3">{filtered.length} itens encontrados</div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Bitola</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum item encontrado</TableCell></TableRow>
                ) : paginated.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="max-w-xs truncate">{m.descricao}</TableCell>
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
                              <AlertDialogAction onClick={() => { deleteMaterial(m.id); toast.success('Item excluído'); }}>Excluir</AlertDialogAction>
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

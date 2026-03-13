import { useState, useMemo } from 'react';
import { useProjects, useAddProject, useUpdateProject, useDeleteProject, useSolicitacoes } from '@/hooks/useSupabaseData';
import { formatBRL } from '@/lib/formatCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

export default function ProjectsPage() {
  const { data: projects = [] } = useProjects();
  const { data: solicitacoes = [] } = useSolicitacoes();
  const { canCreateProject, canEditProject, canDeleteProject } = usePermissions();

  const projectCosts = useMemo(() => {
    const costs: Record<string, number> = {};
    solicitacoes.forEach(s => {
      if (s.status === 'Aberta' || s.status === 'Cancelada') return;
      const itens = s.solicitacao_itens || [];
      const total = itens.reduce((a: number, i: any) => a + (i.custo_total || 0), 0);
      costs[s.projeto_id] = (costs[s.projeto_id] || 0) + total;
    });
    return costs;
  }, [solicitacoes]);
  const addProject = useAddProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ numero: '', descricao: '' });

  const filtered = projects.filter(p =>
    p.numero.toLowerCase().includes(search.toLowerCase()) ||
    p.descricao.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!form.numero.trim() || !form.descricao.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    try {
      if (editingId) {
        await updateProject.mutateAsync({ id: editingId, ...form });
        toast.success('Projeto atualizado');
      } else {
        await addProject.mutateAsync(form);
        toast.success('Projeto criado');
      }
      setOpen(false);
    } catch (e: any) {
      if (e.message?.includes('duplicate') || e.code === '23505') {
        toast.error('Número do projeto já existe');
      } else {
        toast.error('Erro ao salvar projeto');
      }
    }
  };

  const openEdit = (p: typeof projects[0]) => {
    setEditingId(p.id);
    setForm({ numero: p.numero, descricao: p.descricao });
    setOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ numero: '', descricao: '' });
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projetos</h1>
        {canCreateProject && (
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Projeto</Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Projeto' : 'Novo Projeto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Número do Projeto *</Label>
              <Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="PRJ-001" />
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição do projeto" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSave} disabled={addProject.isPending || updateProject.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Buscar projetos..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Data de Criação</TableHead>
                <TableHead className="text-right">Custo Total</TableHead>
                {(canEditProject || canDeleteProject) && <TableHead className="w-24">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum projeto encontrado</TableCell></TableRow>
              ) : filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono font-medium">{p.numero}</TableCell>
                  <TableCell>{p.descricao}</TableCell>
                  <TableCell className="text-muted-foreground">{p.data_criacao}</TableCell>
                  <TableCell className="text-right font-mono font-medium">{formatBRL(projectCosts[p.id] || 0)}</TableCell>
                  {(canEditProject || canDeleteProject) && (
                    <TableCell>
                      <div className="flex gap-1">
                        {canEditProject && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        )}
                        {canDeleteProject && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => { deleteProject.mutate(p.id); toast.success('Projeto excluído'); }}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

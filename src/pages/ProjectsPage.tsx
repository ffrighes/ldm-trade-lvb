import { useState, useMemo } from 'react';
import { useProjects, useAddProject, useUpdateProject, useDeleteProject, useSolicitacoes } from '@/hooks/useSupabaseData';
import { formatBRL } from '@/lib/formatCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SearchInput } from '@/components/SearchInput';
import { useSearch } from '@/hooks/useSearch';
import { highlightMatch } from '@/lib/highlight';
import { SEARCH_MIN_LENGTH } from '@/lib/sanitizeSearch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

export default function ProjectsPage() {
  const navigate = useNavigate();
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

  const search = useSearch({
    debounceMs: 300,
    storageKey: 'projects:recent-searches',
  });
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ numero: '', descricao: '' });

  const filtered = useMemo(() => {
    const term = search.debounced.toLowerCase();
    if (!term) return projects;
    return projects.filter(
      (p) =>
        p.numero.toLowerCase().includes(term) ||
        p.descricao.toLowerCase().includes(term),
    );
  }, [projects, search.debounced]);

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
          <SearchInput
            value={search.input}
            onChange={search.setInput}
            placeholder="Buscar projetos..."
            ariaLabel="Buscar projetos"
            ariaControls="projects-results-status"
            isLoading={search.isDebouncing}
            showBelowMinHint={search.isBelowMin}
            belowMinHint={`Digite ao menos ${SEARCH_MIN_LENGTH} caracteres para buscar.`}
          />
          <span
            id="projects-results-status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {search.debounced
              ? `${filtered.length} resultado(s) para "${search.debounced}"`
              : `${filtered.length} projeto(s)`}
          </span>
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
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {search.debounced
                      ? <>Nenhum projeto encontrado para <strong>"{search.debounced}"</strong>. Tente outro termo.</>
                      : 'Nenhum projeto encontrado'}
                  </TableCell>
                </TableRow>
              ) : filtered.map(p => {
                const openProject = () => navigate(`/projetos/${p.id}/solicitacoes`);
                return (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={openProject}
                  onKeyDown={(e) => { if (e.key === 'Enter') openProject(); }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Abrir solicitações do projeto ${p.numero}`}
                >
                  <TableCell className="font-mono font-medium">{highlightMatch(p.numero, search.debounced)}</TableCell>
                  <TableCell>{highlightMatch(p.descricao, search.debounced)}</TableCell>
                  <TableCell className="text-muted-foreground">{p.data_criacao}</TableCell>
                  <TableCell className="text-right font-mono font-medium">{formatBRL(projectCosts[p.id] || 0)}</TableCell>
                  {(canEditProject || canDeleteProject) && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {canEditProject && (
                          <Button variant="ghost" size="icon" aria-label="Editar projeto" onClick={(e) => { e.stopPropagation(); openEdit(p); }}><Pencil className="h-4 w-4" /></Button>
                        )}
                        {canDeleteProject && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Excluir projeto" onClick={(e) => e.stopPropagation()}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={(e) => { e.stopPropagation(); deleteProject.mutate(p.id); toast.success('Projeto excluído'); }}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

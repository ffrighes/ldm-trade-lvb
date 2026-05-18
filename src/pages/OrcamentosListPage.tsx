import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileSpreadsheet, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOrcamentos, useDeleteOrcamento } from '@/hooks/useOrcamentos';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjects } from '@/hooks/useSupabaseData';

export default function OrcamentosListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canCreateOrcamento, canDeleteOrcamento } = usePermissions();
  const { data: projects = [] } = useProjects();
  const [projetoFilter, setProjetoFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: orcamentos = [], isLoading } = useOrcamentos(projetoFilter || undefined);
  const deleteMutation = useDeleteOrcamento();

  const filtered = orcamentos.filter((o) => {
    const term = search.toLowerCase();
    return (
      o.nome.toLowerCase().includes(term) || o.numero.toLowerCase().includes(term)
    );
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast({ title: 'Orçamento excluído' });
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            Orçamentos
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gerencie orçamentos comparativos com múltiplos fornecedores
          </p>
        </div>
        {canCreateOrcamento && (
          <Button onClick={() => navigate('/orcamentos/novo')}>
            <Plus className="h-4 w-4 mr-2" />
            Novo orçamento
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Buscar por nome ou número..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={projetoFilter || '__all__'}
          onValueChange={(v) => setProjetoFilter(v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os projetos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os projetos</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.numero} — {p.descricao}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground py-8 text-center">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center">
          {search || projetoFilter
            ? 'Nenhum orçamento encontrado para os filtros selecionados.'
            : 'Nenhum orçamento criado ainda.'}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Origem BOM</TableHead>
                <TableHead>Atualizado em</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => {
                const proj = o as typeof o & { projeto?: { numero: string; descricao: string } | null };
                return (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/orcamentos/${o.id}`)}
                  >
                    <TableCell className="font-mono font-medium">{o.numero}</TableCell>
                    <TableCell>{o.nome}</TableCell>
                    <TableCell>
                      {proj.projeto
                        ? `${proj.projeto.numero} — ${proj.projeto.descricao}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {o.origem_bom_root_codigo
                        ? `${o.origem_bom_root_codigo}${o.origem_bom_version_label ? ` v${o.origem_bom_version_label}` : ''}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(o.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canDeleteOrcamento && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(o.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os itens e cotações do orçamento serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

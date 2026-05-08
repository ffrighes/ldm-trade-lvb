import { useState } from 'react';
import { Bookmark, Check, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSavedViews, useSaveView, useDeleteSavedView } from '@/hooks/useSupabaseData';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Props {
  currentFilters: Record<string, unknown>;
  onApply: (filters: Record<string, unknown>) => void;
}

export function SavedViewsMenu({ currentFilters, onApply }: Props) {
  const { user } = useAuth();
  const { data: views = [], isLoading } = useSavedViews();
  const saveView = useSaveView();
  const deleteView = useDeleteSavedView();
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');

  if (!user) return null;

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Dê um nome ao filtro');
      return;
    }
    try {
      await saveView.mutateAsync({ name: trimmed, filters: currentFilters });
      toast.success(`Filtro "${trimmed}" salvo`);
      setSaveOpen(false);
      setName('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar filtro');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, viewName: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteView.mutateAsync(id);
      toast.success(`Filtro "${viewName}" removido`);
    } catch {
      toast.error('Erro ao remover filtro');
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Filtros salvos">
            <Bookmark className="h-4 w-4 mr-2" />
            Filtros salvos
            {views.length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground tabular-nums">({views.length})</span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Meus filtros</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {isLoading ? (
            <DropdownMenuItem disabled>Carregando…</DropdownMenuItem>
          ) : views.length === 0 ? (
            <DropdownMenuItem disabled className="text-muted-foreground">
              Nenhum filtro salvo
            </DropdownMenuItem>
          ) : (
            views.map((v) => (
              <DropdownMenuItem
                key={v.id}
                onSelect={() => onApply(v.filters)}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Check className="h-3 w-3 opacity-50 shrink-0" />
                  <span className="truncate">{v.name}</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, v.id, v.name)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  aria-label={`Excluir filtro ${v.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setSaveOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Salvar filtros atuais
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar filtros atuais</DialogTitle>
            <DialogDescription>
              Salva busca, status, projeto e período como um atalho rápido.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="saved-view-name">Nome</Label>
            <Input
              id="saved-view-name"
              placeholder="Ex.: Abertas do projeto X"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
              maxLength={60}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveView.isPending}>
              {saveView.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Settings2,
  Trash2,
  Link2,
  Link2Off,
  ChevronRight,
  Package,
  Edit2,
  Check,
  X,
  Loader2,
  GitBranch,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import {
  type Assembly,
  useAssemblies,
  useDirectChildren,
  useDirectParents,
  useCreateAssembly,
  useUpdateAssembly,
  useDeleteAssembly,
  useRemoveEdge,
  useUpdateEdgeQuantity,
} from '@/hooks/useAssemblyBom';
import { AddToParentsDialog } from '@/components/assembly/AddToParentsDialog';
import { BomExplodedTree } from '@/components/assembly/BomExplodedTree';

// ─── Helpers ─────────────────────────────────────────────────────────

function fmtQty(n: number): string {
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(3).replace(/\.?0+$/, '');
}

// ─── Create / Edit Assembly Dialog ───────────────────────────────────

interface AssemblyFormDialogProps {
  open: boolean;
  onClose: () => void;
  existing?: Assembly;
}

function AssemblyFormDialog({ open, onClose, existing }: AssemblyFormDialogProps) {
  const createAssembly = useCreateAssembly();
  const updateAssembly = useUpdateAssembly();

  const [code, setCode] = useState(existing?.code ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  const [weight, setWeight] = useState(existing?.unit_weight?.toString() ?? '');

  const isEdit = !!existing;

  // Reset on open
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      onClose();
    } else {
      setCode(existing?.code ?? '');
      setName(existing?.name ?? '');
      setWeight(existing?.unit_weight?.toString() ?? '');
    }
  };

  const handleSubmit = async () => {
    if (!code.trim() || !name.trim()) return;
    const w = weight.trim() ? parseFloat(weight) : null;
    if (weight.trim() && (isNaN(w!) || w! <= 0)) {
      toast.error('Peso unitário inválido — deve ser > 0.');
      return;
    }
    try {
      if (isEdit) {
        await updateAssembly.mutateAsync({ id: existing!.id, code: code.trim(), name: name.trim(), unit_weight: w });
        toast.success('Assembly atualizado.');
      } else {
        await createAssembly.mutateAsync({ code: code.trim(), name: name.trim(), unit_weight: w });
        toast.success('Assembly criado.');
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar assembly.');
    }
  };

  const pending = createAssembly.isPending || updateAssembly.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar assembly' : 'Novo assembly'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="asm-code" className="text-xs">
              Código <span className="text-destructive">*</span>
            </Label>
            <Input
              id="asm-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ex.: ASM-001"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asm-name" className="text-xs">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="asm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex.: Suporte lateral"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asm-weight" className="text-xs">
              Peso unitário (kg)
            </Label>
            <Input
              id="asm-weight"
              type="number"
              min="0.001"
              step="0.001"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="opcional"
              className="font-mono"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!code.trim() || !name.trim() || pending}>
            {pending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {isEdit ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Inline quantity editor ───────────────────────────────────────────

function InlineQtyEditor({
  parentId,
  childId,
  quantity,
}: {
  parentId: string;
  childId: string;
  quantity: number;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(fmtQty(quantity));
  const updateQty = useUpdateEdgeQuantity();

  const save = async () => {
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) { setVal(fmtQty(quantity)); setEditing(false); return; }
    try {
      await updateQty.mutateAsync({ parentId, childId, quantity: n });
    } catch {
      toast.error('Erro ao atualizar quantidade.');
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        className="font-mono text-xs tabular-nums px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
        onClick={() => { setVal(fmtQty(quantity)); setEditing(true); }}
        title="Clique para editar"
      >
        ×{fmtQty(quantity)}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Input
        autoFocus
        type="number"
        min="0.001"
        step="1"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        className="w-20 h-6 text-xs font-mono text-right"
      />
      <button onClick={save} className="text-emerald-500 hover:text-emerald-600">
        <Check className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────

export default function AssemblyBomPage() {
  const { data: assemblies = [], isLoading } = useAssemblies();
  const deleteAssembly = useDeleteAssembly();
  const removeEdge = useRemoveEdge();

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Assembly | undefined>();
  const [addParentsOpen, setAddParentsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Assembly | undefined>();

  const assembliesById = useMemo(
    () => Object.fromEntries(assemblies.map((a) => [a.id, a])),
    [assemblies],
  );

  const selected = selectedId ? assembliesById[selectedId] : undefined;

  const { data: children = [] } = useDirectChildren(selectedId);
  const { data: parents = [] } = useDirectParents(selectedId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assemblies;
    return assemblies.filter(
      (a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q),
    );
  }, [assemblies, search]);

  const handleDelete = async (a: Assembly) => {
    try {
      await deleteAssembly.mutateAsync(a.id);
      if (selectedId === a.id) setSelectedId(undefined);
      toast.success(`${a.code} excluído.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir.');
    }
    setDeleteTarget(undefined);
  };

  const handleRemoveEdge = async (parentId: string, childId: string) => {
    try {
      await removeEdge.mutateAsync({ parentId, childId });
      toast.success('Relação removida.');
    } catch {
      toast.error('Erro ao remover relação.');
    }
  };

  return (
    <div className="space-y-0">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <h1 className="text-base font-semibold tracking-tight">Assemblies — BOM Multinível</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Grafo acíclico dirigido · um assembly pode ter múltiplos pais
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Nova montagem
        </Button>
      </div>

      {/* ── Main layout ── */}
      <div className="grid grid-cols-[300px_1fr] gap-4 min-h-[600px]">
        {/* Left: assembly list */}
        <div className="border border-border rounded-lg overflow-hidden flex flex-col bg-card">
          <div className="px-3 py-2.5 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar código ou nome…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Carregando…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {search ? 'Nenhum resultado.' : 'Nenhum assembly cadastrado.'}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {filtered.map((a) => {
                  const active = a.id === selectedId;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors group ${
                        active
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-muted/50 text-foreground'
                      }`}
                    >
                      <Package className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/60" />
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs font-semibold truncate">{a.code}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{a.name}</div>
                      </div>
                      <ChevronRight
                        className={`h-3.5 w-3.5 flex-shrink-0 transition-opacity ${
                          active ? 'opacity-70' : 'opacity-0 group-hover:opacity-40'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-3 py-2 border-t border-border bg-muted/20">
            <p className="text-[11px] text-muted-foreground">
              {assemblies.length} {assemblies.length === 1 ? 'assembly' : 'assemblies'}
            </p>
          </div>
        </div>

        {/* Right: detail panel */}
        {!selected ? (
          <div className="border border-border rounded-lg flex items-center justify-center bg-muted/10">
            <div className="text-center">
              <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Selecione um assembly à esquerda</p>
            </div>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden flex flex-col bg-card">
            {/* Detail header */}
            <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-lg font-bold tracking-tight">{selected.code}</span>
                  {parents.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                      {parents.length} {parents.length === 1 ? 'pai' : 'pais'}
                    </Badge>
                  )}
                  {children.length > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 h-5">
                      {children.length} {children.length === 1 ? 'filho' : 'filhos'}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{selected.name}</p>
                {selected.unit_weight != null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Peso unit.:{' '}
                    <span className="font-mono">{selected.unit_weight} kg</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddParentsOpen(true)}
                  className="text-xs"
                >
                  <Link2 className="h-3.5 w-3.5 mr-1.5" />
                  Adicionar a pais…
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditTarget(selected)}
                  title="Editar assembly"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget(selected)}
                  title="Excluir assembly"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="exploded" className="flex-1 flex flex-col">
              <TabsList className="mx-5 mt-3 mb-0 w-fit h-8 bg-muted/50">
                <TabsTrigger value="exploded" className="text-xs px-3 h-6">
                  BOM explodido
                </TabsTrigger>
                <TabsTrigger value="children" className="text-xs px-3 h-6">
                  Filhos diretos
                  {children.length > 0 && (
                    <span className="ml-1.5 text-[10px] font-mono bg-muted px-1 rounded">
                      {children.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="parents" className="text-xs px-3 h-6">
                  Pais diretos
                  {parents.length > 0 && (
                    <span className="ml-1.5 text-[10px] font-mono bg-muted px-1 rounded">
                      {parents.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* BOM explodido */}
              <TabsContent value="exploded" className="flex-1 overflow-auto px-5 pb-5 mt-3">
                <BomExplodedTree rootId={selected.id} assembliesById={assembliesById} />
              </TabsContent>

              {/* Filhos diretos */}
              <TabsContent value="children" className="flex-1 overflow-auto px-5 pb-5 mt-3">
                {children.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum filho direto. Adicione arestas pelo painel de outro assembly
                    usando "Adicionar a pais…".
                  </div>
                ) : (
                  <div className="divide-y divide-border/40 border border-border rounded-md overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted/30">
                      <span>Assembly filho</span>
                      <span className="text-right w-24">Qtd. neste pai</span>
                      <span className="w-8" />
                    </div>
                    {children.map((edge) => {
                      const a = edge.child;
                      return (
                        <div
                          key={edge.child_id}
                          className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2.5 items-center hover:bg-muted/30 transition-colors"
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-xs font-semibold">{a.code}</span>
                            <span className="ml-2 text-xs text-muted-foreground truncate">
                              {a.name}
                            </span>
                          </div>
                          <InlineQtyEditor
                            parentId={edge.parent_id}
                            childId={edge.child_id}
                            quantity={edge.quantity}
                          />
                          <button
                            className="flex items-center justify-center w-8 h-8 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            onClick={() => handleRemoveEdge(edge.parent_id, edge.child_id)}
                            title="Remover relação (não exclui o assembly)"
                          >
                            <Link2Off className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Pais diretos */}
              <TabsContent value="parents" className="flex-1 overflow-auto px-5 pb-5 mt-3">
                {parents.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Este assembly não tem pais — é uma raiz solta.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddParentsOpen(true)}
                      className="text-xs"
                    >
                      <Link2 className="h-3.5 w-3.5 mr-1.5" />
                      Adicionar a pais…
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40 border border-border rounded-md overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted/30">
                      <span>Assembly pai</span>
                      <span className="text-right w-24">Qtd. usada</span>
                      <span className="w-8" />
                    </div>
                    {parents.map((edge) => {
                      const a = edge.parent;
                      return (
                        <div
                          key={edge.parent_id}
                          className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2.5 items-center hover:bg-muted/30 transition-colors"
                        >
                          <div className="min-w-0">
                            <button
                              className="font-mono text-xs font-semibold hover:underline"
                              onClick={() => setSelectedId(edge.parent_id)}
                              title="Navegar para este pai"
                            >
                              {a.code}
                            </button>
                            <span className="ml-2 text-xs text-muted-foreground truncate">
                              {a.name}
                            </span>
                          </div>
                          <span className="font-mono text-xs text-right w-24 tabular-nums">
                            ×{fmtQty(edge.quantity)}
                          </span>
                          <button
                            className="flex items-center justify-center w-8 h-8 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            onClick={() => handleRemoveEdge(edge.parent_id, edge.child_id)}
                            title="Desvincular deste pai"
                          >
                            <Link2Off className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}

      <AssemblyFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {editTarget && (
        <AssemblyFormDialog
          open
          onClose={() => setEditTarget(undefined)}
          existing={editTarget}
        />
      )}

      {selected && (
        <AddToParentsDialog
          open={addParentsOpen}
          onClose={() => setAddParentsOpen(false)}
          child={selected}
          existingParentIds={parents.map((p) => p.parent_id)}
        />
      )}

      {deleteTarget && (
        <AlertDialog open onOpenChange={() => setDeleteTarget(undefined)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir assembly?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong className="font-mono">{deleteTarget.code}</strong> — {deleteTarget.name}
                <br />
                <br />
                Todas as relações com pais e filhos serão removidas em cascata. Esta ação não pode
                ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => handleDelete(deleteTarget)}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

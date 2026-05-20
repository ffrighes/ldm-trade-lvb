import { useState, useEffect, useCallback } from 'react';
import { Search, AlertTriangle, Check, X, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  type Assembly,
  type AddToParentsEntry,
  useAssemblies,
  useAddToParents,
  checkWouldCycle,
} from '@/hooks/useAssemblyBom';

interface Props {
  open: boolean;
  onClose: () => void;
  child: Assembly;
  existingParentIds: string[];
}

interface CandidateState {
  selected: boolean;
  quantity: string;
  cycleRisk: boolean | null; // null = checking
}

export function AddToParentsDialog({ open, onClose, child, existingParentIds }: Props) {
  const { data: allAssemblies = [] } = useAssemblies();
  const addToParents = useAddToParents();

  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<Record<string, CandidateState>>({});
  const [cycleChecking, setCycleChecking] = useState<Set<string>>(new Set());

  // Candidate assemblies: exclude self and already-linked parents
  const eligible = allAssemblies.filter(
    (a) => a.id !== child.id && !existingParentIds.includes(a.id),
  );

  const filtered = search.trim()
    ? eligible.filter(
        (a) =>
          a.code.toLowerCase().includes(search.toLowerCase()) ||
          a.name.toLowerCase().includes(search.toLowerCase()),
      )
    : eligible;

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearch('');
      setCandidates({});
      setCycleChecking(new Set());
    }
  }, [open]);

  const toggleCandidate = useCallback(
    async (assembly: Assembly) => {
      const id = assembly.id;
      const current = candidates[id];

      if (current?.selected) {
        // Deselect
        setCandidates((prev) => ({ ...prev, [id]: { ...prev[id], selected: false } }));
        return;
      }

      // Select and trigger cycle check
      setCandidates((prev) => ({
        ...prev,
        [id]: { selected: true, quantity: '1', cycleRisk: null },
      }));

      setCycleChecking((prev) => new Set(prev).add(id));

      const wouldCycle = await checkWouldCycle(id, child.id);

      setCycleChecking((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setCandidates((prev) => ({
        ...prev,
        [id]: { ...prev[id], cycleRisk: wouldCycle },
      }));
    },
    [candidates, child.id],
  );

  const setQuantity = (id: string, val: string) => {
    setCandidates((prev) => ({ ...prev, [id]: { ...prev[id], quantity: val } }));
  };

  const selected = Object.entries(candidates).filter(([, s]) => s.selected);
  const hasConflicts = selected.some(([, s]) => s.cycleRisk);
  const hasInvalidQty = selected.some(([, s]) => {
    const n = parseFloat(s.quantity);
    return isNaN(n) || n <= 0;
  });
  const isChecking = cycleChecking.size > 0;

  const handleSubmit = async () => {
    if (hasConflicts || hasInvalidQty || isChecking) return;

    const parents: AddToParentsEntry[] = selected.map(([parentId, s]) => ({
      parent_id: parentId,
      quantity: parseFloat(s.quantity),
    }));

    try {
      await addToParents.mutateAsync({ childId: child.id, parents });
      toast.success(
        `${child.code} adicionado a ${parents.length} ${parents.length === 1 ? 'pai' : 'pais'}.`,
      );
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Nenhuma relação foi criada. ${msg}`);
    }
  };

  const assemblyById = Object.fromEntries(allAssemblies.map((a) => [a.id, a]));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            Adicionar a pais
          </DialogTitle>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="font-mono text-base font-bold text-foreground">{child.code}</span>
            <span className="text-sm text-muted-foreground">{child.name}</span>
          </div>
        </DialogHeader>

        {/* Selected summary */}
        {selected.length > 0 && (
          <div className="px-6 py-2 bg-muted/40 border-b border-border">
            <div className="flex flex-wrap gap-2">
              {selected.map(([id, s]) => {
                const a = assemblyById[id];
                if (!a) return null;
                const checking = cycleChecking.has(id);
                const conflict = s.cycleRisk;
                return (
                  <div
                    key={id}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border ${
                      conflict
                        ? 'border-destructive/50 bg-destructive/10 text-destructive'
                        : checking
                          ? 'border-border bg-muted text-muted-foreground'
                          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {checking ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : conflict ? (
                      <AlertTriangle className="h-3 w-3" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    <span className="font-mono">{a.code}</span>
                    <span className="opacity-70">×{s.quantity}</span>
                    <button
                      className="opacity-50 hover:opacity-100 ml-0.5"
                      onClick={() =>
                        setCandidates((prev) => ({ ...prev, [id]: { ...prev[id], selected: false } }))
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
            {hasConflicts && (
              <p className="mt-2 text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Pais em vermelho criariam um ciclo — remova-os para prosseguir.
              </p>
            )}
          </div>
        )}

        {/* Search */}
        <div className="px-6 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou nome…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {search ? 'Nenhum resultado.' : 'Nenhum assembly disponível.'}
            </p>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((a) => {
                const state = candidates[a.id];
                const isSelected = state?.selected ?? false;
                const checking = cycleChecking.has(a.id);
                const conflict = state?.cycleRisk;

                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                      isSelected
                        ? conflict
                          ? 'bg-destructive/8 border border-destructive/30'
                          : 'bg-accent border border-accent-foreground/10'
                        : 'hover:bg-muted/50 border border-transparent'
                    }`}
                    onClick={() => toggleCandidate(a)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleCandidate(a)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {a.code}
                        </span>
                        {conflict && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="destructive"
                                  className="text-[10px] px-1.5 py-0 h-4"
                                >
                                  ciclo
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-60 text-xs">
                                Adicionar <strong>{child.code}</strong> a <strong>{a.code}</strong>{' '}
                                criaria um ciclo — <strong>{a.code}</strong> já é descendente de{' '}
                                <strong>{child.code}</strong>.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {checking && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{a.name}</p>
                    </div>

                    {isSelected && !conflict && (
                      <div
                        className="flex items-center gap-1.5 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-xs text-muted-foreground">Qtd.</span>
                        <Input
                          type="number"
                          min="0.001"
                          step="1"
                          value={state?.quantity ?? '1'}
                          onChange={(e) => setQuantity(a.id, e.target.value)}
                          className="w-20 h-7 text-xs text-right font-mono"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <div className="flex items-center gap-3 w-full">
            <span className="text-xs text-muted-foreground flex-1">
              {selected.length === 0
                ? 'Selecione ao menos um pai.'
                : `${selected.length} ${selected.length === 1 ? 'pai selecionado' : 'pais selecionados'}`}
            </span>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={
                selected.length === 0 ||
                hasConflicts ||
                hasInvalidQty ||
                isChecking ||
                addToParents.isPending
              }
            >
              {addToParents.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Plus className="h-3.5 w-3.5 mr-1.5" />
              )}
              Adicionar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

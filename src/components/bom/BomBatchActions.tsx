import { useEffect, useState } from 'react';
import { Trash2, FolderInput, Hash, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  useBatchMoveBomNodes, useBatchRemoveBomNodes, useBatchSetBomNodeQuantity,
} from '@/hooks/useBomTree';

export interface MoveTarget {
  id: string;
  label: string;
  depth: number;
}

interface Props {
  versionId: string;
  /** Selected node ids, in tree order. */
  selectedIds: string[];
  /** Valid move destinations (assemblies not inside the current selection). */
  moveTargets: MoveTarget[];
  /** Clears the current selection (called after a successful batch op). */
  onClear: () => void;
}

/**
 * Contextual batch-action bar for the BOM tree. Renders only when at least one
 * node is selected and offers atomic remove / move / set-quantity operations.
 * Destructive actions (remove, move) are gated behind a confirmation step.
 */
export function BomBatchActions({ versionId, selectedIds, moveTargets, onClear }: Props) {
  const count = selectedIds.length;
  const remove = useBatchRemoveBomNodes();
  const move = useBatchMoveBomNodes();
  const setQty = useBatchSetBomNodeQuantity();

  const [confirmRemove, setConfirmRemove] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [qtyOpen, setQtyOpen] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [qtyValue, setQtyValue] = useState('1');

  // Reset the chosen move target whenever the dialog (re)opens.
  useEffect(() => {
    if (moveOpen) setTargetId(null);
  }, [moveOpen]);

  if (count === 0) return null;

  const pending = remove.isPending || move.isPending || setQty.isPending;

  const handleRemove = async () => {
    try {
      const n = await remove.mutateAsync({ versionId, nodeIds: selectedIds });
      toast.success(`${n} item(ns) removido(s)`);
      onClear();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover em lote');
    } finally {
      setConfirmRemove(false);
    }
  };

  const handleMove = async () => {
    if (!targetId) return;
    try {
      const n = await move.mutateAsync({ versionId, nodeIds: selectedIds, newParentId: targetId });
      toast.success(`${n} item(ns) movido(s)`);
      setMoveOpen(false);
      onClear();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao mover em lote');
    }
  };

  const handleSetQty = async () => {
    const qty = Number(qtyValue);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Quantidade deve ser > 0');
      return;
    }
    try {
      const n = await setQty.mutateAsync({ versionId, nodeIds: selectedIds, quantity: qty });
      toast.success(`Quantidade ajustada em ${n} item(ns)`);
      setQtyOpen(false);
      onClear();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao ajustar quantidade');
    }
  };

  return (
    <>
      <div
        role="toolbar"
        aria-label="Ações em lote"
        className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-2 rounded-md border bg-primary/5 px-3 py-2 shadow-sm"
        onKeyDown={(e) => { if (e.key === 'Escape') onClear(); }}
      >
        <span className="text-sm font-medium" aria-live="polite">
          {count} selecionado(s)
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setQtyValue('1'); setQtyOpen(true); }}
            disabled={pending}
          >
            <Hash className="h-3.5 w-3.5 mr-1.5" /> Ajustar qtd.
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMoveOpen(true)}
            disabled={pending || moveTargets.length === 0}
            title={moveTargets.length === 0 ? 'Nenhum destino disponível' : 'Mover seleção'}
          >
            <FolderInput className="h-3.5 w-3.5 mr-1.5" /> Mover
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmRemove(true)}
            disabled={pending}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remover
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClear}
            disabled={pending}
            aria-label="Limpar seleção"
            title="Limpar seleção"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Remove confirmation */}
      <AlertDialog open={confirmRemove} onOpenChange={(o) => { if (!o) setConfirmRemove(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {count} item(ns)?</AlertDialogTitle>
            <AlertDialogDescription>
              Os nós selecionados e suas subárvores serão removidos. Esta ação é
              atômica: se algum item não puder ser removido, nenhuma alteração é aplicada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={remove.isPending}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move dialog (selecting a target + confirming) */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mover {count} item(ns)</DialogTitle>
            <DialogDescription>
              Escolha o Conjunto ou Subconjunto de destino. Destinos dentro da
              própria seleção são omitidos.
            </DialogDescription>
          </DialogHeader>
          <div
            role="radiogroup"
            aria-label="Destino"
            className="max-h-72 overflow-y-auto rounded-md border divide-y"
          >
            {moveTargets.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={targetId === t.id}
                onClick={() => setTargetId(t.id)}
                className={`flex w-full items-center px-3 py-2 text-left text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                  targetId === t.id ? 'bg-primary/10 font-medium' : 'hover:bg-muted/50'
                }`}
                style={{ paddingLeft: `${t.depth * 16 + 12}px` }}
              >
                {t.label}
              </button>
            ))}
            {moveTargets.length === 0 && (
              <div className="px-3 py-4 text-sm text-muted-foreground">
                Nenhum destino disponível.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)} disabled={move.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleMove} disabled={!targetId || move.isPending}>
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust quantity dialog */}
      <Dialog open={qtyOpen} onOpenChange={setQtyOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar quantidade</DialogTitle>
            <DialogDescription>
              A quantidade será aplicada a todos os {count} item(ns) selecionados.
            </DialogDescription>
          </DialogHeader>
          <div className="py-1">
            <Label htmlFor="batch-qty" className="text-xs font-medium text-foreground/80">
              Quantidade *
            </Label>
            <Input
              id="batch-qty"
              type="number"
              min={0}
              step="any"
              value={qtyValue}
              autoFocus
              onChange={(e) => setQtyValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSetQty(); } }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQtyOpen(false)} disabled={setQty.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSetQty} disabled={setQty.isPending}>
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

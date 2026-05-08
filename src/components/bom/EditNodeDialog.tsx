import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateBomNode } from '@/hooks/useBomTree';
import { toast } from 'sonner';
import type { BomTreeNode } from '@/types/bom';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: BomTreeNode | null;
}

export function EditNodeDialog({ open, onOpenChange, node }: Props) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const update = useUpdateBomNode();

  useEffect(() => {
    if (!node) return;
    setName(node.name ?? '');
    setQuantity(node.quantity != null ? String(node.quantity) : '1');
    setNotes(node.notes ?? '');
  }, [node]);

  if (!node) return null;
  const isItem = node.node_type === 'ITEM';
  const isConjunto = node.node_type === 'CONJUNTO';

  const submit = async () => {
    const qty = isConjunto ? null : Number(quantity);
    if (!isConjunto && (!Number.isFinite(qty as number) || (qty as number) <= 0)) {
      toast.error('Quantidade deve ser > 0'); return;
    }
    if (!isItem && !name.trim()) {
      toast.error('Nome é obrigatório'); return;
    }
    try {
      await update.mutateAsync({
        versionId: node.version_id,
        nodeId: node.id,
        name: isItem ? null : name.trim(),
        quantity: qty,
        notes: notes.trim() || null,
        clearNotes: notes.trim() === '',
      });
      toast.success('Nó atualizado');
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar nó</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!isItem && (
            <div>
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          {!isConjunto && (
            <div>
              <Label>Quantidade *</Label>
              <Input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={update.isPending}>{update.isPending ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

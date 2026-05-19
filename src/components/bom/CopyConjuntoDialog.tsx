import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useBomRoots,
  useBomVersions,
  useCloneBomRoot,
  useSetBomRootParent,
  useSetBomRootQuantityInParent,
  buildRootTree,
  getDescendantIds,
} from '@/hooks/useBomTree';
import { toast } from 'sonner';
import type { BomRootTreeNode } from '@/types/bom';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  defaultSourceRootId?: string;
  onCopied?: (rootId: string, versionId: string) => void;
}

function flattenTree(nodes: BomRootTreeNode[], out: BomRootTreeNode[] = []) {
  for (const n of nodes) {
    out.push(n);
    if (n.children.length) flattenTree(n.children, out);
  }
  return out;
}

export function CopyConjuntoDialog({ open, onOpenChange, projectId, defaultSourceRootId, onCopied }: Props) {
  const { data: roots = [] } = useBomRoots(projectId);
  const [sourceRootId, setSourceRootId] = useState<string>('');
  const [sourceVersionId, setSourceVersionId] = useState<string>('');
  const [destParentId, setDestParentId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [codigo, setCodigo] = useState('');
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');

  const { data: versions = [] } = useBomVersions(sourceRootId || undefined);

  const clone = useCloneBomRoot();
  const setParent = useSetBomRootParent();
  const setQty = useSetBomRootQuantityInParent();

  const sourceRoot = useMemo(() => roots.find((r) => r.id === sourceRootId), [roots, sourceRootId]);

  // Destination options: exclude source + its descendants to avoid cycles.
  const destOptions = useMemo(() => {
    const tree = buildRootTree(roots);
    const flat = flattenTree(tree);
    if (!sourceRootId) return flat;
    const forbidden = getDescendantIds(roots, sourceRootId);
    return flat.filter((r) => !forbidden.has(r.id));
  }, [roots, sourceRootId]);

  // Reset on open / source change.
  useEffect(() => {
    if (open) {
      setSourceRootId(defaultSourceRootId ?? '');
      setSourceVersionId('');
      setDestParentId('');
      setQuantity('1');
      setLabel('');
      setNotes('');
    }
  }, [open, defaultSourceRootId]);

  // Auto-select best version when source changes.
  useEffect(() => {
    if (!versions.length) { setSourceVersionId(''); return; }
    const released = versions.find((v) => v.status === 'RELEASED');
    setSourceVersionId((released ?? versions[0]).id);
  }, [versions]);

  // Prefill new codigo/name from source.
  useEffect(() => {
    if (sourceRoot) {
      setCodigo(`${sourceRoot.codigo}-COPY`);
      setName(`${sourceRoot.name} (cópia)`);
    } else {
      setCodigo('');
      setName('');
    }
  }, [sourceRoot]);

  const busy = clone.isPending || setParent.isPending || setQty.isPending;

  const submit = async () => {
    if (!sourceRootId) { toast.error('Selecione o conjunto de origem'); return; }
    if (!sourceVersionId) { toast.error('Selecione uma versão de origem'); return; }
    if (!destParentId) { toast.error('Selecione o conjunto destino'); return; }
    if (!codigo.trim() || !name.trim()) { toast.error('Código e nome são obrigatórios'); return; }
    const qty = Number(quantity.replace(',', '.'));
    if (!(qty > 0)) { toast.error('Quantidade no pai deve ser maior que zero'); return; }

    try {
      const res = await clone.mutateAsync({
        sourceVersionId,
        targetProjectId: projectId,
        codigo: codigo.trim(),
        name: name.trim(),
        label: label.trim() || null,
        notes: notes.trim() || null,
      });
      await setParent.mutateAsync({ rootId: res.root_id, projectId, parentId: destParentId });
      if (qty !== 1) {
        await setQty.mutateAsync({ rootId: res.root_id, projectId, quantity: qty });
      }
      toast.success('Conjunto copiado (DRAFT)');
      onCopied?.(res.root_id, res.version_id);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao copiar conjunto');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Copiar Conjunto para dentro de outro</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>Conjunto de origem *</Label>
              <Select value={sourceRootId} onValueChange={setSourceRootId}>
                <SelectTrigger><SelectValue placeholder="Selecione um Conjunto…" /></SelectTrigger>
                <SelectContent>
                  {roots.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.codigo} — {r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Versão de origem *</Label>
              <Select value={sourceVersionId} onValueChange={setSourceVersionId} disabled={!sourceRootId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma versão…" /></SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      v{v.version_number} {v.label ? `— ${v.label}` : ''} ({v.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conjunto destino (pai) *</Label>
              <Select value={destParentId} onValueChange={setDestParentId} disabled={!sourceRootId}>
                <SelectTrigger><SelectValue placeholder="Selecione o pai…" /></SelectTrigger>
                <SelectContent>
                  {destOptions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {'\u00A0\u00A0'.repeat(r.depth)}{r.codigo} — {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade no pai *</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div>
              <Label>Novo código *</Label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </div>
            <div>
              <Label>Novo nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Rótulo da v1 (opcional)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={1} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Copiando…' : 'Copiar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

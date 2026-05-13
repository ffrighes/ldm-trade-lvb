import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBomRoots, useCreateConjunto } from '@/hooks/useBomTree';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** When provided, the parent selector is hidden and the new Conjunto is created under this root. */
  defaultParentId?: string | null;
  onCreated?: (rootId: string, versionId: string) => void;
}

function suggestChildCodigo(parentCodigo: string, siblingCodigos: string[]): string {
  const prefix = `${parentCodigo}.`;
  const used = new Set(siblingCodigos);
  for (let i = 1; i < 1000; i++) {
    const candidate = `${prefix}${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return prefix;
}

export function CreateConjuntoDialog({ open, onOpenChange, projectId, defaultParentId, onCreated }: Props) {
  const [codigo, setCodigo] = useState('');
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const create = useCreateConjunto();
  const { data: roots = [] } = useBomRoots(projectId);

  const lockedParent = defaultParentId != null;
  const effectiveParentId = lockedParent ? defaultParentId ?? '' : parentId;
  const parentRoot = roots.find((r) => r.id === effectiveParentId);

  // When opened with a default parent, pre-fill a suggested codigo.
  useEffect(() => {
    if (!open || !lockedParent || !parentRoot) return;
    const siblings = roots.filter((r) => r.parent_id === parentRoot.id).map((r) => r.codigo);
    setCodigo((current) => current || suggestChildCodigo(parentRoot.codigo, siblings));
  }, [open, lockedParent, parentRoot, roots]);

  const reset = () => { setCodigo(''); setName(''); setParentId(''); setLabel(''); setNotes(''); };

  const submit = async () => {
    if (!codigo.trim() || !name.trim()) {
      toast.error('Código e nome são obrigatórios');
      return;
    }
    try {
      const res = await create.mutateAsync({
        projectId,
        codigo: codigo.trim(),
        name: name.trim(),
        parentId: effectiveParentId || null,
        label: label.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success(`Conjunto ${codigo} criado`);
      onCreated?.(res.root_id, res.version_id);
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar Conjunto');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {lockedParent && parentRoot
              ? `Novo Conjunto filho de ${parentRoot.codigo}`
              : 'Novo Conjunto'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Código *</Label>
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ex.: CJ-001" />
          </div>
          <div>
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do produto/módulo" />
          </div>
          {!lockedParent && roots.length > 0 && (
            <div>
              <Label>Conjunto pai (opcional)</Label>
              <Select value={parentId || '__none__'} onValueChange={(v) => setParentId(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="— Nenhum (raiz) —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum (raiz) —</SelectItem>
                  {roots.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="font-mono text-xs mr-2">{r.codigo}</span>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Rótulo da versão (opcional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex.: Rev A" />
          </div>
          <div>
            <Label>Notas (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'Criando…' : 'Criar Conjunto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

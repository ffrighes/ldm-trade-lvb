import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNewBomVersion } from '@/hooks/useBomTree';
import type { BomVersion } from '@/types/bom';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootId: string;
  versions: BomVersion[];
  defaultSourceId?: string;
  onCreated?: (versionId: string) => void;
}

export function NewVersionDialog({ open, onOpenChange, rootId, versions, defaultSourceId, onCreated }: Props) {
  const [sourceId, setSourceId] = useState<string>(defaultSourceId ?? versions[0]?.id ?? '');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const create = useNewBomVersion();

  useEffect(() => {
    if (open) setSourceId(defaultSourceId ?? versions[0]?.id ?? '');
  }, [open, defaultSourceId, versions]);

  const submit = async () => {
    try {
      const id = await create.mutateAsync({
        rootId,
        sourceVersionId: sourceId || null,
        label: label.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success('Nova versão criada (DRAFT)');
      onCreated?.(id);
      setLabel(''); setNotes('');
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar versão');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova versão</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Versão de origem</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
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
            <Label>Rótulo (opcional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex.: Rev B" />
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={create.isPending}>{create.isPending ? 'Criando…' : 'Criar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

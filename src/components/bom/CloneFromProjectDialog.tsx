import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjects } from '@/hooks/useSupabaseData';
import { useBomRoots, useBomVersions, useCloneBomRoot } from '@/hooks/useBomTree';
import { toast } from 'sonner';

interface ProjectLite { id: string; numero: string; descricao: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetProjectId: string;
  onCloned?: (rootId: string, versionId: string) => void;
}

export function CloneFromProjectDialog({ open, onOpenChange, targetProjectId, onCloned }: Props) {
  const { data: projects = [] } = useProjects();
  const [sourceProjectId, setSourceProjectId] = useState<string>('');
  const [sourceRootId, setSourceRootId] = useState<string>('');
  const [sourceVersionId, setSourceVersionId] = useState<string>('');
  const [codigo, setCodigo] = useState('');
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');

  const { data: roots = [] } = useBomRoots(sourceProjectId || undefined);
  const { data: versions = [] } = useBomVersions(sourceRootId || undefined);
  const clone = useCloneBomRoot();

  const otherProjects = useMemo(
    () => (projects as ProjectLite[]).filter((p) => p.id !== targetProjectId),
    [projects, targetProjectId],
  );

  useEffect(() => { if (open) { setSourceRootId(''); setSourceVersionId(''); } }, [open, sourceProjectId]);
  useEffect(() => { setSourceVersionId(''); }, [sourceRootId]);

  const submit = async () => {
    if (!sourceVersionId) { toast.error('Selecione uma versão de origem'); return; }
    if (!codigo.trim() || !name.trim()) { toast.error('Código e nome são obrigatórios'); return; }
    try {
      const res = await clone.mutateAsync({
        sourceVersionId,
        targetProjectId,
        codigo: codigo.trim(),
        name: name.trim(),
        label: label.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success('Conjunto clonado (DRAFT)');
      onCloned?.(res.root_id, res.version_id);
      onOpenChange(false);
      setSourceProjectId(''); setSourceRootId(''); setSourceVersionId('');
      setCodigo(''); setName(''); setLabel(''); setNotes('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao clonar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Clonar Conjunto de outro projeto</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>Projeto de origem *</Label>
              <Select value={sourceProjectId} onValueChange={setSourceProjectId}>
                <SelectTrigger><SelectValue placeholder="Selecione um projeto…" /></SelectTrigger>
                <SelectContent>
                  {otherProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.numero} — {p.descricao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conjunto *</Label>
              <Select value={sourceRootId} onValueChange={setSourceRootId} disabled={!sourceProjectId}>
                <SelectTrigger><SelectValue placeholder="Selecione um Conjunto…" /></SelectTrigger>
                <SelectContent>
                  {roots.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.codigo} — {r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Versão *</Label>
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
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div>
              <Label>Novo código *</Label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ex.: CJ-100" />
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
          <Button onClick={submit} disabled={clone.isPending}>{clone.isPending ? 'Clonando…' : 'Clonar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateBomRoot, getDescendantIds } from '@/hooks/useBomTree';
import { toast } from 'sonner';
import type { BomRoot } from '@/types/bom';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  rootId: string | null;
  codigo: string;
  currentName: string;
  currentParentId: string | null;
  isDraft: boolean;
  allRoots: BomRoot[];
}

export function EditConjuntoDialog({
  open, onOpenChange, projectId, rootId, codigo, currentName, currentParentId, isDraft, allRoots,
}: Props) {
  const [name, setName] = useState(currentName);
  const [codigoEdit, setCodigoEdit] = useState(codigo);
  const [parentId, setParentId] = useState<string>(currentParentId ?? '');
  const update = useUpdateBomRoot();

  useEffect(() => {
    if (open) {
      setName(currentName);
      setCodigoEdit(codigo);
      setParentId(currentParentId ?? '');
    }
  }, [open, currentName, codigo, currentParentId]);

  // Exclude self and all descendants from the parent options to prevent cycles
  const excludedIds = rootId ? getDescendantIds(allRoots, rootId) : new Set<string>();
  const parentOptions = allRoots.filter((r) => !excludedIds.has(r.id));

  const submit = async () => {
    if (!rootId) return;
    const trimmedName = name.trim();
    const trimmedCodigo = codigoEdit.trim();
    if (!trimmedName) {
      toast.error('Descrição é obrigatória');
      return;
    }
    if (isDraft && !trimmedCodigo) {
      toast.error('Código é obrigatório');
      return;
    }
    const nameChanged = trimmedName !== currentName;
    const codigoChanged = isDraft && trimmedCodigo !== codigo;
    const resolvedParent = parentId || null;
    const parentChanged = resolvedParent !== currentParentId;

    if (!nameChanged && !codigoChanged && !parentChanged) {
      onOpenChange(false);
      return;
    }
    try {
      await update.mutateAsync({
        rootId,
        projectId,
        name: trimmedName,
        ...(codigoChanged ? { codigo: trimmedCodigo } : {}),
        ...(parentChanged ? { parentId: resolvedParent } : {}),
      });
      const parts: string[] = [];
      if (codigoChanged && nameChanged) parts.push('Código e descrição atualizados');
      else if (codigoChanged) parts.push('Código atualizado');
      else if (nameChanged) parts.push('Descrição atualizada');
      if (parentChanged) parts.push('Pai atualizado');
      toast.success(parts.join(' · ') || 'Salvo');
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar Conjunto</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Código{isDraft ? ' *' : ''}</Label>
            <Input
              value={codigoEdit}
              onChange={isDraft ? (e) => setCodigoEdit(e.target.value) : undefined}
              disabled={!isDraft}
              placeholder="ex.: CJ-001"
            />
          </div>
          <div>
            <Label>Descrição *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do produto/módulo"
              autoFocus
            />
          </div>
          {parentOptions.length > 0 && (
            <div>
              <Label>Conjunto pai</Label>
              <Select value={parentId || '__none__'} onValueChange={(v) => setParentId(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="— Nenhum (raiz) —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum (raiz) —</SelectItem>
                  {parentOptions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="font-mono text-xs mr-2">{r.codigo}</span>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={update.isPending}>
            {update.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

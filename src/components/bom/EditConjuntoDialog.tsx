import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateBomRoot } from '@/hooks/useBomTree';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  rootId: string | null;
  codigo: string;
  currentName: string;
  isDraft: boolean;
}

export function EditConjuntoDialog({ open, onOpenChange, projectId, rootId, codigo, currentName, isDraft }: Props) {
  const [name, setName] = useState(currentName);
  const [codigoEdit, setCodigoEdit] = useState(codigo);
  const update = useUpdateBomRoot();

  useEffect(() => {
    if (open) {
      setName(currentName);
      setCodigoEdit(codigo);
    }
  }, [open, currentName, codigo]);

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
    if (!nameChanged && !codigoChanged) {
      onOpenChange(false);
      return;
    }
    try {
      await update.mutateAsync({
        rootId,
        projectId,
        name: trimmedName,
        ...(codigoChanged ? { codigo: trimmedCodigo } : {}),
      });
      const msg = codigoChanged && nameChanged
        ? 'Código e descrição atualizados'
        : codigoChanged
        ? 'Código atualizado'
        : 'Descrição atualizada';
      toast.success(msg);
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

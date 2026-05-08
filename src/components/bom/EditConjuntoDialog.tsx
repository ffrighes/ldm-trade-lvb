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
}

export function EditConjuntoDialog({ open, onOpenChange, projectId, rootId, codigo, currentName }: Props) {
  const [name, setName] = useState(currentName);
  const update = useUpdateBomRoot();

  useEffect(() => {
    if (open) setName(currentName);
  }, [open, currentName]);

  const submit = async () => {
    if (!rootId) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Descrição é obrigatória');
      return;
    }
    if (trimmed === currentName) {
      onOpenChange(false);
      return;
    }
    try {
      await update.mutateAsync({ rootId, projectId, name: trimmed });
      toast.success('Descrição atualizada');
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar descrição');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar descrição do Conjunto</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Código</Label>
            <Input value={codigo} disabled />
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

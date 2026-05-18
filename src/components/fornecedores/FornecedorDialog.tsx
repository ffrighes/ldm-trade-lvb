import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Fornecedor } from '@/hooks/useFornecedores';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Fornecedor | null;
  onSave: (data: { nome: string; observacoes: string }) => Promise<void>;
  saving: boolean;
}

export function FornecedorDialog({ open, onOpenChange, initial, onSave, saving }: Props) {
  const [nome, setNome] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    if (open) {
      setNome(initial?.nome ?? '');
      setObservacoes(initial?.observacoes ?? '');
    }
  }, [open, initial]);

  const handleSave = async () => {
    if (!nome.trim()) return;
    await onSave({ nome: nome.trim(), observacoes });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Nome *</Label>
            <Input
              className="mt-2"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="Nome do fornecedor"
              autoFocus
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea
              className="mt-2"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving || !nome.trim()}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

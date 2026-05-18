import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Fornecedor } from '@/hooks/useFornecedores';

const REGIMES = [
  { value: 'lucro_real', label: 'Lucro Real' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'simples_nacional', label: 'Simples Nacional' },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Fornecedor | null;
  onSave: (data: { nome: string; observacoes: string; regime_tributario: string }) => Promise<void>;
  saving: boolean;
}

export function FornecedorDialog({ open, onOpenChange, initial, onSave, saving }: Props) {
  const [nome, setNome] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [regimeTributario, setRegimeTributario] = useState('lucro_real');

  useEffect(() => {
    if (open) {
      setNome(initial?.nome ?? '');
      setObservacoes(initial?.observacoes ?? '');
      setRegimeTributario(initial?.regime_tributario ?? 'lucro_real');
    }
  }, [open, initial]);

  const handleSave = async () => {
    if (!nome.trim()) return;
    await onSave({ nome: nome.trim(), observacoes, regime_tributario: regimeTributario });
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
            <Label>Regime tributário *</Label>
            <Select value={regimeTributario} onValueChange={setRegimeTributario}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIMES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

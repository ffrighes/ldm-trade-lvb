import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Fornecedor {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fornecedores: Fornecedor[];
  selected: string[];
  onConfirm: (ids: string[]) => void;
  loading?: boolean;
}

export function SelectFornecedoresDialog({
  open,
  onOpenChange,
  fornecedores,
  selected,
  onConfirm,
  loading,
}: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set(selected));
  const [search, setSearch] = useState('');

  const filtered = fornecedores.filter((f) =>
    f.nome.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar fornecedores</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Buscar fornecedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />

        <div className="max-h-64 overflow-y-auto space-y-1 border rounded p-2">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-2 text-center">
              Nenhum fornecedor encontrado
            </p>
          )}
          {filtered.map((f) => (
            <div key={f.id} className="flex items-center gap-2 py-1">
              <Checkbox
                id={`forn-${f.id}`}
                checked={checked.has(f.id)}
                onCheckedChange={() => toggle(f.id)}
              />
              <Label htmlFor={`forn-${f.id}`} className="cursor-pointer text-sm">
                {f.nome}
              </Label>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm([...checked])} disabled={loading}>
            {loading ? 'Salvando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

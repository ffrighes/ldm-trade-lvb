import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Props {
  open: boolean;
  categories: string[];
  onCancel: () => void;
  onConfirm: (category: string) => void;
}

export function SelectCategoryDialog({ open, categories, onCancel, onConfirm }: Props) {
  const [selected, setSelected] = useState<string>('');

  const handleCancel = () => {
    setSelected('');
    onCancel();
  };

  const handleConfirm = () => {
    if (!selected) return;
    const cat = selected;
    setSelected('');
    onConfirm(cat);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Selecionar categoria de destino</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Categoria</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria…" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
                {/* TODO: adicionar opção "+ Criar nova categoria" quando houver UI dedicada para criação de categoria */}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selected}>Continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

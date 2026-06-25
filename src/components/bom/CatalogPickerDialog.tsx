import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStandardCatalog } from '@/hooks/useBomTree';
import { normalizeForSearch } from '@/lib/normalizeSearch';
import type { BomRoot } from '@/types/bom';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user confirms a selection. */
  onSelect: (childRoot: BomRoot, quantity: number) => void;
  /** Root IDs already linked (to prevent duplicate entries in the UI). */
  existingChildIds?: Set<string>;
}

export function CatalogPickerDialog({ open, onOpenChange, onSelect, existingChildIds = new Set() }: Props) {
  const { data: catalog = [], isLoading } = useStandardCatalog();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<BomRoot | null>(null);
  const [quantity, setQuantity] = useState('1');

  const filtered = catalog.filter((r) => {
    const q = normalizeForSearch(search);
    return normalizeForSearch(r.codigo).includes(q) || normalizeForSearch(r.name).includes(q);
  });

  function handleOpenChange(v: boolean) {
    if (!v) {
      setSearch('');
      setSelected(null);
      setQuantity('1');
    }
    onOpenChange(v);
  }

  function handleConfirm() {
    if (!selected) return;
    const qty = parseFloat(quantity);
    if (!(qty > 0)) return;
    onSelect(selected, qty);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Conjunto do Catálogo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou nome…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              autoFocus
            />
          </div>

          <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
            {isLoading && (
              <p className="text-sm text-muted-foreground px-3 py-4 text-center">Carregando catálogo…</p>
            )}
            {!isLoading && filtered.length === 0 && (
              <p className="text-sm text-muted-foreground px-3 py-4 text-center">
                Nenhum template encontrado.
              </p>
            )}
            {filtered.map((r) => {
              const already = existingChildIds.has(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={already}
                  onClick={() => !already && setSelected(r)}
                  className={[
                    'w-full text-left px-3 py-2 transition-colors',
                    already ? 'opacity-40 cursor-not-allowed bg-muted/30' : 'hover:bg-muted',
                    selected?.id === r.id && !already ? 'bg-muted' : '',
                  ].join(' ')}
                >
                  <span className="font-mono text-xs text-muted-foreground mr-2">{r.codigo}</span>
                  <span className="text-sm">{r.name}</span>
                  {already && (
                    <span className="ml-2 text-xs text-muted-foreground">(já adicionado)</span>
                  )}
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="flex items-center gap-3">
              <Label htmlFor="catalog-qty" className="shrink-0">
                Quantidade
              </Label>
              <Input
                id="catalog-qty"
                type="number"
                min="0.001"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground truncate">
                × {selected.codigo} — {selected.name}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selected || !(parseFloat(quantity) > 0)}
          >
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

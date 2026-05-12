import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMaterials } from '@/hooks/useSupabaseData';
import { useAddBomNode } from '@/hooks/useBomTree';
import { toast } from 'sonner';
import { ChevronsUpDown } from 'lucide-react';

interface MaterialLite { id: string; descricao: string; bitola: string; unidade: string; }

function parseBitolaValue(b: string): number {
  const trimmed = b.trim();
  const spaceParts = trimmed.split(' ');
  if (spaceParts.length === 2) {
    const whole = parseFloat(spaceParts[0]) || 0;
    const fracParts = spaceParts[1].split('/');
    const frac = fracParts.length === 2 ? (parseFloat(fracParts[0]) || 0) / (parseFloat(fracParts[1]) || 1) : 0;
    return whole + frac;
  }
  if (trimmed.includes('/')) {
    const fracParts = trimmed.split('/');
    return (parseFloat(fracParts[0]) || 0) / (parseFloat(fracParts[1]) || 1);
  }
  return parseFloat(trimmed) || 0;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionId: string;
  parentId: string;
  /** if parent is ITEM, dialog should not be opened — UI guards this */
  defaultTab?: 'subconjunto' | 'item';
}

export function AddNodeDialog({ open, onOpenChange, versionId, parentId, defaultTab = 'subconjunto' }: Props) {
  const [tab, setTab] = useState<'subconjunto' | 'item'>(defaultTab);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [familia, setFamilia] = useState<string | null>(null);
  const [familiaSearchOpen, setFamiliaSearchOpen] = useState(false);
  const [materialId, setMaterialId] = useState<string | null>(null);

  const { data: materials = [] } = useMaterials();
  const add = useAddBomNode();

  const familias = useMemo(() => {
    const set = new Set<string>();
    (materials as MaterialLite[]).forEach((m) => set.add(m.descricao));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [materials]);

  const bitolasForFamilia = useMemo(() => {
    if (!familia) return [] as MaterialLite[];
    return (materials as MaterialLite[])
      .filter((m) => m.descricao === familia)
      .sort((a, b) => parseBitolaValue(a.bitola) - parseBitolaValue(b.bitola));
  }, [materials, familia]);

  useEffect(() => {
    if (!familia) { setMaterialId(null); return; }
    if (materialId && !bitolasForFamilia.some((m) => m.id === materialId)) {
      setMaterialId(null);
    }
  }, [familia, bitolasForFamilia, materialId]);

  const selectedMaterial = useMemo(
    () => (materials as MaterialLite[]).find((m) => m.id === materialId) ?? null,
    [materials, materialId],
  );

  const reset = () => {
    setName(''); setQuantity('1'); setNotes(''); setFamilia(null); setMaterialId(null);
  };

  const submit = async () => {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Quantidade deve ser > 0'); return;
    }
    if (tab === 'subconjunto' && !name.trim()) {
      toast.error('Nome do subconjunto é obrigatório'); return;
    }
    if (tab === 'item' && !familia) {
      toast.error('Selecione uma família'); return;
    }
    if (tab === 'item' && !materialId) {
      toast.error('Selecione a bitola'); return;
    }
    try {
      await add.mutateAsync({
        versionId,
        parentId,
        nodeType: tab === 'subconjunto' ? 'SUBCONJUNTO' : 'ITEM',
        name: tab === 'subconjunto' ? name.trim() : null,
        materialId: tab === 'item' ? materialId : null,
        quantity: qty,
        notes: notes.trim() || null,
      });
      toast.success(tab === 'subconjunto' ? 'Subconjunto adicionado' : 'Item adicionado');
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao adicionar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adicionar nó</DialogTitle></DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="subconjunto">Subconjunto</TabsTrigger>
            <TabsTrigger value="item">Item</TabsTrigger>
          </TabsList>
          <TabsContent value="subconjunto" className="space-y-3 pt-3">
            <div>
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do subconjunto" />
            </div>
            <div>
              <Label>Quantidade *</Label>
              <Input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </TabsContent>
          <TabsContent value="item" className="space-y-3 pt-3">
            <div>
              <Label>Família *</Label>
              <Popover open={familiaSearchOpen} onOpenChange={setFamiliaSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between" type="button">
                    <span className="truncate">{familia ?? 'Buscar família…'}</span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-w-[640px]">
                  <Command>
                    <CommandInput placeholder="Buscar família…" />
                    <CommandList>
                      <CommandEmpty>Nenhuma família.</CommandEmpty>
                      <CommandGroup>
                        {familias.map((f) => (
                          <CommandItem
                            key={f}
                            value={f}
                            onSelect={() => { setFamilia(f); setFamiliaSearchOpen(false); }}
                          >
                            <span className="truncate">{f}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Bitola *</Label>
              <Select
                value={materialId ?? ''}
                onValueChange={(v) => setMaterialId(v)}
                disabled={!familia || bitolasForFamilia.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={familia ? 'Selecionar bitola…' : 'Selecione uma família primeiro'} />
                </SelectTrigger>
                <SelectContent>
                  {bitolasForFamilia.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.bitola} <span className="text-xs text-muted-foreground">· {m.unidade}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMaterial && (
                <p className="text-xs text-muted-foreground mt-1">Unidade: {selectedMaterial.unidade}</p>
              )}
            </div>
            <div>
              <Label>Quantidade *</Label>
              <Input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={add.isPending}>{add.isPending ? 'Adicionando…' : 'Adicionar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

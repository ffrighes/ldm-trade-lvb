import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMaterials } from '@/hooks/useSupabaseData';
import { useAddBomNode } from '@/hooks/useBomTree';
import { toast } from 'sonner';
import { ChevronsUpDown } from 'lucide-react';

interface MaterialLite { id: string; descricao: string; bitola: string; unidade: string; }

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
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [matSearchOpen, setMatSearchOpen] = useState(false);

  const { data: materials = [] } = useMaterials();
  const add = useAddBomNode();

  const selectedMaterial = useMemo(
    () => (materials as MaterialLite[]).find((m) => m.id === materialId) ?? null,
    [materials, materialId],
  );

  const reset = () => {
    setName(''); setQuantity('1'); setNotes(''); setMaterialId(null);
  };

  const submit = async () => {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Quantidade deve ser > 0'); return;
    }
    if (tab === 'subconjunto' && !name.trim()) {
      toast.error('Nome do subconjunto é obrigatório'); return;
    }
    if (tab === 'item' && !materialId) {
      toast.error('Selecione um item da base de dados'); return;
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
              <Label>Item da base de dados *</Label>
              <Popover open={matSearchOpen} onOpenChange={setMatSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between" type="button">
                    {selectedMaterial
                      ? `${selectedMaterial.descricao}${selectedMaterial.bitola ? ` — ${selectedMaterial.bitola}` : ''}`
                      : 'Selecionar item…'}
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-w-[640px]">
                  <Command>
                    <CommandInput placeholder="Buscar por descrição ou bitola…" />
                    <CommandList>
                      <CommandEmpty>Nenhum item.</CommandEmpty>
                      <CommandGroup>
                        {(materials as MaterialLite[]).map((m) => (
                          <CommandItem
                            key={m.id}
                            value={`${m.descricao} ${m.bitola}`}
                            onSelect={() => { setMaterialId(m.id); setMatSearchOpen(false); }}
                          >
                            <span className="truncate">{m.descricao}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{m.bitola} · {m.unidade}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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

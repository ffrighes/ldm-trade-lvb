import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (item: {
    material_id: string | null;
    descricao: string;
    bitola: string;
    erp: string;
    unidade: string;
    quantidade: number;
  }) => void;
  loading?: boolean;
}

export function AddOrcamentoItemDialog({ open, onOpenChange, onConfirm, loading }: Props) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{
    id: string; descricao: string; bitola: string; erp: string; unidade: string;
  } | null>(null);
  const [quantidade, setQuantidade] = useState('1');
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState({ descricao: '', bitola: '', erp: '', unidade: 'un' });

  const { data: materiais = [] } = useQuery({
    queryKey: ['materials_search', search],
    enabled: search.length >= 2 && !manualMode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, descricao, bitola, erp, unidade')
        .or(`descricao.ilike.%${search}%,bitola.ilike.%${search}%`)
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleConfirm = () => {
    const qty = parseFloat(quantidade) || 0;
    if (manualMode) {
      onConfirm({ material_id: null, ...manual, quantidade: qty });
    } else if (selected) {
      onConfirm({ material_id: selected.id, descricao: selected.descricao, bitola: selected.bitola, erp: selected.erp, unidade: selected.unidade, quantidade: qty });
    }
  };

  const reset = () => {
    setSearch('');
    setSelected(null);
    setQuantidade('1');
    setManualMode(false);
    setManual({ descricao: '', bitola: '', erp: '', unidade: 'un' });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar item ao orçamento</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-3">
          <Button size="sm" variant={!manualMode ? 'default' : 'outline'} onClick={() => setManualMode(false)}>Buscar material</Button>
          <Button size="sm" variant={manualMode ? 'default' : 'outline'} onClick={() => setManualMode(true)}>Item avulso</Button>
        </div>

        {!manualMode ? (
          <>
            <Input
              placeholder="Buscar por descrição ou bitola..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
            />
            {materiais.length > 0 && !selected && (
              <div className="max-h-48 overflow-y-auto border rounded mt-1">
                {materiais.map((m) => (
                  <button
                    key={m.id}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                    onClick={() => setSelected(m)}
                  >
                    <span className="font-medium">{m.descricao}</span>
                    {m.bitola && <span className="text-muted-foreground ml-2">{m.bitola}</span>}
                  </button>
                ))}
              </div>
            )}
            {selected && (
              <div className="border rounded p-2 bg-muted/40 text-sm">
                <span className="font-medium">{selected.descricao}</span>
                {selected.bitola && <span className="text-muted-foreground ml-2">{selected.bitola}</span>}
                <button className="ml-2 text-xs text-destructive" onClick={() => setSelected(null)}>remover</button>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Descrição *</Label>
              <Input value={manual.descricao} onChange={(e) => setManual((p) => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Bitola</Label>
              <Input value={manual.bitola} onChange={(e) => setManual((p) => ({ ...p, bitola: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>ERP</Label>
              <Input value={manual.erp} onChange={(e) => setManual((p) => ({ ...p, erp: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Unidade</Label>
              <Input value={manual.unidade} onChange={(e) => setManual((p) => ({ ...p, unidade: e.target.value }))} />
            </div>
          </div>
        )}

        <div className="space-y-1 mt-2">
          <Label>Quantidade</Label>
          <Input
            type="number"
            min={0}
            step="any"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || (!manualMode && !selected) || (manualMode && !manual.descricao)}
          >
            {loading ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FornecedorPrecoComMaterial } from '@/hooks/useFornecedores';
import type { Database } from '@/integrations/supabase/types';

type Material = Database['public']['Tables']['materials']['Row'];

interface PrecoForm {
  material_id: string;
  codigo_fornecedor: string;
  valor_unitario: string;
  moeda: string;
  moq: string;
  lead_time_dias: string;
  desconto_pct: string;
  ipi_pct: string;
  icms_pct: string;
  data_cotacao: string;
  notas: string;
}

const defaultForm = (): PrecoForm => ({
  material_id: '',
  codigo_fornecedor: '',
  valor_unitario: '',
  moeda: 'BRL',
  moq: '1',
  lead_time_dias: '0',
  desconto_pct: '0',
  ipi_pct: '0',
  icms_pct: '0',
  data_cotacao: new Date().toISOString().split('T')[0],
  notas: '',
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: FornecedorPrecoComMaterial | null;
  materials: Material[];
  onSave: (data: {
    material_id: string;
    codigo_fornecedor: string;
    valor_unitario: number;
    moeda: string;
    moq: number;
    lead_time_dias: number;
    desconto_pct: number;
    ipi_pct: number;
    icms_pct: number;
    data_cotacao: string;
    notas: string;
  }) => Promise<void>;
  saving: boolean;
}

export function PrecoDialog({ open, onOpenChange, initial, materials, onSave, saving }: Props) {
  const [form, setForm] = useState<PrecoForm>(defaultForm);
  const [comboOpen, setComboOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          material_id: initial.material_id,
          codigo_fornecedor: initial.codigo_fornecedor,
          valor_unitario: initial.valor_unitario.toString(),
          moeda: initial.moeda,
          moq: initial.moq.toString(),
          lead_time_dias: initial.lead_time_dias.toString(),
          desconto_pct: initial.desconto_pct.toString(),
          ipi_pct: initial.ipi_pct.toString(),
          icms_pct: initial.icms_pct.toString(),
          data_cotacao: initial.data_cotacao,
          notas: initial.notas,
        });
      } else {
        setForm(defaultForm());
      }
      setError('');
    }
  }, [open, initial]);

  const f = (field: keyof PrecoForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === form.material_id) ?? null,
    [materials, form.material_id],
  );

  const handleSave = async () => {
    if (!form.material_id) { setError('Selecione um material.'); return; }
    const valor = parseFloat(form.valor_unitario.replace(',', '.'));
    if (isNaN(valor) || valor < 0) { setError('Valor unitário inválido.'); return; }
    setError('');
    await onSave({
      material_id: form.material_id,
      codigo_fornecedor: form.codigo_fornecedor,
      valor_unitario: valor,
      moeda: form.moeda,
      moq: parseFloat(form.moq) || 1,
      lead_time_dias: parseInt(form.lead_time_dias) || 0,
      desconto_pct: parseFloat(form.desconto_pct) || 0,
      ipi_pct: parseFloat(form.ipi_pct) || 0,
      icms_pct: parseFloat(form.icms_pct) || 0,
      data_cotacao: form.data_cotacao,
      notas: form.notas,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar Cotação' : 'Nova Cotação'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Material *</Label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboOpen}
                  className="w-full justify-between mt-2 font-normal"
                  disabled={!!initial}
                >
                  {selectedMaterial ? (
                    <span className="font-mono text-sm">
                      {selectedMaterial.descricao} <span className="text-muted-foreground">{selectedMaterial.bitola}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Selecionar material...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px] p-0">
                <Command>
                  <CommandInput placeholder="Buscar material..." />
                  <CommandList>
                    <CommandEmpty>Nenhum material encontrado.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                      {materials.map((m) => (
                        <CommandItem
                          key={m.id}
                          value={`${m.descricao} ${m.bitola}`}
                          onSelect={() => {
                            f('material_id', m.id);
                            setComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn('mr-2 h-4 w-4', form.material_id === m.id ? 'opacity-100' : 'opacity-0')}
                          />
                          <span className="font-mono text-sm">
                            {m.descricao} <span className="text-muted-foreground">{m.bitola}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Código no Fornecedor</Label>
              <Input className="mt-2" value={form.codigo_fornecedor} onChange={(e) => f('codigo_fornecedor', e.target.value)} placeholder="Ref. do fornecedor" />
            </div>
            <div>
              <Label>Data da Cotação</Label>
              <Input className="mt-2" type="date" value={form.data_cotacao} onChange={(e) => f('data_cotacao', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Valor Unit. *</Label>
              <Input className="mt-2" value={form.valor_unitario} onChange={(e) => f('valor_unitario', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Moeda</Label>
              <Select value={form.moeda} onValueChange={(v) => f('moeda', v)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>MOQ</Label>
              <Input className="mt-2" value={form.moq} onChange={(e) => f('moq', e.target.value)} placeholder="1" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label>Lead time (dias)</Label>
              <Input className="mt-2" value={form.lead_time_dias} onChange={(e) => f('lead_time_dias', e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Desconto %</Label>
              <Input className="mt-2" value={form.desconto_pct} onChange={(e) => f('desconto_pct', e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>IPI %</Label>
              <Input className="mt-2" value={form.ipi_pct} onChange={(e) => f('ipi_pct', e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>ICMS %</Label>
              <Input className="mt-2" value={form.icms_pct} onChange={(e) => f('icms_pct', e.target.value)} placeholder="0" />
            </div>
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea className="mt-2" value={form.notas} onChange={(e) => f('notas', e.target.value)} placeholder="Observações da cotação..." rows={2} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFornecedores, useAddFornecedor } from '@/hooks/useFornecedores';

interface FornecedorPickerProps {
  value: string | null; // fornecedor_id
  onChange: (id: string | null) => void;
  disabled?: boolean;
  /** Permite criar fornecedor inline (gated por permissão pelo chamador). */
  canCreate?: boolean;
}

/**
 * Seleção de fornecedor a partir da tabela mestre `fornecedores`, com criação
 * inline opcional. Usa o mesmo SearchableSelect da Estrutura de Produto.
 */
export function FornecedorPicker({ value, onChange, disabled, canCreate = true }: FornecedorPickerProps) {
  const { data: fornecedores = [] } = useFornecedores();
  const addFornecedor = useAddFornecedor();

  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');

  const names = useMemo(() => fornecedores.map((f) => f.nome).sort((a, b) => a.localeCompare(b)), [fornecedores]);
  const selectedName = useMemo(
    () => fornecedores.find((f) => f.id === value)?.nome ?? '',
    [fornecedores, value],
  );

  const handleSelect = (name: string) => {
    const f = fornecedores.find((x) => x.nome === name);
    onChange(f?.id ?? null);
  };

  const handleCreate = async () => {
    const trimmed = nome.trim();
    if (!trimmed) {
      toast.error('Informe o nome do fornecedor');
      return;
    }
    try {
      const created = await addFornecedor.mutateAsync({ nome: trimmed });
      onChange(created.id);
      setNome('');
      setOpen(false);
      toast.success('Fornecedor criado');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('duplicate') || (e as { code?: string })?.code === '23505') {
        toast.error('Já existe um fornecedor com esse nome');
      } else {
        toast.error('Erro ao criar fornecedor');
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <SearchableSelect
          options={names}
          value={selectedName}
          onValueChange={handleSelect}
          disabled={disabled}
          placeholder="Selecione o fornecedor"
          searchPlaceholder="Buscar fornecedor..."
          emptyMessage="Nenhum fornecedor encontrado."
        />
      </div>
      {canCreate && !disabled && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Novo fornecedor"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="novo-fornecedor-nome">Nome *</Label>
            <Input
              id="novo-fornecedor-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do fornecedor"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={addFornecedor.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

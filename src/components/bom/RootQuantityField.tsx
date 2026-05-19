import { useEffect, useRef, useState } from 'react';
import { Check, Edit3, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSetBomRootQuantityInParent } from '@/hooks/useBomTree';
import type { BomRoot } from '@/types/bom';

interface Props {
  root: BomRoot;
  projectId: string;
  canEdit: boolean;
}

export function RootQuantityField({ root, projectId, canEdit }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const setQty = useSetBomRootQuantityInParent();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEdit = () => {
    setDraft(String(root.quantity_in_parent));
    setIsEditing(true);
  };

  const cancel = () => setIsEditing(false);

  const confirm = async () => {
    const v = Number(draft);
    if (!Number.isFinite(v) || v <= 0) {
      toast.error('Quantidade deve ser maior que zero');
      return;
    }
    if (v === root.quantity_in_parent) {
      setIsEditing(false);
      return;
    }
    try {
      await setQty.mutateAsync({ rootId: root.id, projectId, quantity: v });
      toast.success('Quantidade atualizada');
      setIsEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar quantidade');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Quantidade no Conjunto pai:</span>
      {isEditing ? (
        <>
          <Input
            ref={inputRef}
            type="number"
            min="0.000001"
            step="any"
            className="h-7 w-24 font-mono text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={setQty.isPending}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); confirm(); }
              if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-green-600"
            title="Confirmar"
            aria-label="Confirmar quantidade"
            disabled={setQty.isPending}
            onClick={confirm}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Cancelar"
            aria-label="Cancelar edição"
            disabled={setQty.isPending}
            onClick={cancel}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <>
          <span className="font-mono font-semibold">{root.quantity_in_parent}</span>
          {root.quantity_in_parent === 1 && (
            <span className="text-xs text-muted-foreground">(padrão)</span>
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Editar quantidade"
              aria-label="Editar quantidade no Conjunto pai"
              onClick={startEdit}
            >
              <Edit3 className="h-3.5 w-3.5" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}

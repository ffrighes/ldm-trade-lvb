import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
  /** Current persisted quantity (driven by the parent's query cache). */
  quantity: number;
  /** When false the value is shown as a static badge (no editing). */
  canEdit: boolean;
  /**
   * Persists the new quantity. Should perform the optimistic mutation and
   * reject on failure so the editor can surface the error. The optimistic
   * hook is responsible for rolling the cached value back.
   */
  onSave: (quantity: number) => Promise<void>;
  className?: string;
}

/**
 * Inline-editable "× N" quantity badge used in the "Conjuntos filhos" list.
 *
 * Click to edit → numeric input → confirm with Enter/blur, cancel with Esc.
 * The draft lives in local state so keystrokes never re-render the parent list
 * or BOM tree. Validation enforces an integer ≥ 1; persistence and rollback are
 * delegated to the optimistic mutation passed via `onSave`.
 */
export function InlineQuantityEditor({ quantity, canEdit, onSave, className }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guards against the unmount-triggered blur firing a second commit after a
  // commit has already been handled (Enter/Esc both unmount the input).
  const committedRef = useRef(false);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEdit = () => {
    if (!canEdit || saving) return;
    setDraft(String(quantity));
    committedRef.current = false;
    setIsEditing(true);
  };

  const commit = async (mode: 'confirm' | 'cancel') => {
    if (committedRef.current) return;
    committedRef.current = true;

    if (mode === 'cancel') {
      setIsEditing(false);
      return;
    }

    const value = Number(draft.trim());
    if (!Number.isInteger(value) || value < 1) {
      toast.error('Quantidade deve ser um inteiro maior ou igual a 1.');
      setIsEditing(false);
      return;
    }
    if (value === quantity) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(value);
    } catch {
      // The optimistic mutation hook handles the toast + cache rollback; we
      // simply close the editor so the (reverted) value is shown again.
    } finally {
      setSaving(false);
      setIsEditing(false);
    }
  };

  if (!isEditing) {
    if (!canEdit) {
      return (
        <span className={cn('text-xs text-muted-foreground shrink-0', className)}>
          × {quantity}
        </span>
      );
    }
    return (
      <button
        type="button"
        onClick={startEdit}
        disabled={saving}
        className={cn(
          'text-xs text-muted-foreground shrink-0 rounded px-1 py-0.5 font-mono',
          'hover:bg-muted hover:text-foreground transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
        title="Clique para editar a quantidade"
        aria-label={`Editar quantidade (atual: ${quantity})`}
      >
        × {quantity}
      </button>
    );
  }

  return (
    <span
      className={cn('flex items-center gap-1 shrink-0', className)}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-xs text-muted-foreground">×</span>
      <Input
        ref={inputRef}
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        aria-label="Quantidade"
        className="h-7 w-16 px-1 font-mono text-xs"
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit('confirm');
          } else if (e.key === 'Escape') {
            e.preventDefault();
            commit('cancel');
          }
        }}
        onBlur={() => commit('confirm')}
      />
    </span>
  );
}

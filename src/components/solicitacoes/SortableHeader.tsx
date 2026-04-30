import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { SolicitacoesSortField } from '@/hooks/useSupabaseData';

interface Props {
  field: SolicitacoesSortField;
  activeField: SolicitacoesSortField;
  direction: 'asc' | 'desc';
  onSort: (field: SolicitacoesSortField) => void;
  className?: string;
  children: React.ReactNode;
}

export function SortableHeader({ field, activeField, direction, onSort, className, children }: Props) {
  const isActive = field === activeField;
  const Icon = !isActive ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown;
  const ariaSort = !isActive ? 'none' : direction === 'asc' ? 'ascending' : 'descending';

  return (
    <TableHead className={className} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {children}
        <Icon className="h-3 w-3" aria-hidden />
      </button>
    </TableHead>
  );
}

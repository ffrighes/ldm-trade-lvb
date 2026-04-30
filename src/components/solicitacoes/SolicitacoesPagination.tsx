import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  pageSizes: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function SolicitacoesPagination({ page, pageSize, total, pageSizes, onPageChange, onPageSizeChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const firstRow = total === 0 ? 0 : currentPage * pageSize + 1;
  const lastRow = Math.min(total, (currentPage + 1) * pageSize);
  const isFirst = currentPage === 0;
  const isLast = currentPage >= totalPages - 1;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
      <div className="text-sm text-muted-foreground">
        {total === 0 ? 'Nenhum resultado' : `${firstRow}–${lastRow} de ${total}`}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Por página</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="w-20 h-8" aria-label="Itens por página">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map((s) => (
                <SelectItem key={s} value={String(s)}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={isFirst} onClick={() => onPageChange(0)} aria-label="Primeira página">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={isFirst} onClick={() => onPageChange(currentPage - 1)} aria-label="Página anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm tabular-nums px-2 min-w-[5rem] text-center">
            {currentPage + 1} / {totalPages}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={isLast} onClick={() => onPageChange(currentPage + 1)} aria-label="Próxima página">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={isLast} onClick={() => onPageChange(totalPages - 1)} aria-label="Última página">
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

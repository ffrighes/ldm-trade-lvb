import { useMemo, useState } from 'react';
import { Download, FileDown, RefreshCw, Trash2, X, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/hooks/usePermissions';

interface SelectedRow {
  id: string;
  status: string;
}

interface Props {
  selected: SelectedRow[];
  isExporting: boolean;
  isExportingPdf: boolean;
  isMutating: boolean;
  onClear: () => void;
  onChangeStatus: (status: string) => void;
  onDelete: () => void;
  onExport: () => void;
  onExportPdf: () => void;
  onRefreshCosts: () => void;
}

export function BulkActionsBar({
  selected,
  isExporting,
  isExportingPdf,
  isMutating,
  onClear,
  onChangeStatus,
  onDelete,
  onExport,
  onExportPdf,
  onRefreshCosts,
}: Props) {
  const { canChangeStatus, getAllowedStatuses, canDeleteSolicitacao } = usePermissions();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const count = selected.length;

  // Status transitions allowed across the whole selection: intersection of
  // each row's allowed transitions, minus statuses already shared by all rows
  // (no-op transitions get filtered out).
  const allowedBulkStatuses = useMemo(() => {
    if (!canChangeStatus || selected.length === 0) return [] as string[];
    const sets = selected.map((s) => new Set(getAllowedStatuses(s.status) as unknown as string[]));
    const [first, ...rest] = sets;
    const intersection = [...first].filter((s) => rest.every((set) => set.has(s)));
    const allSameStatus = selected.every((s) => s.status === selected[0].status);
    return intersection.filter((s) => !(allSameStatus && s === selected[0].status));
  }, [selected, canChangeStatus, getAllowedStatuses]);

  const allDeletable = selected.every((s) => canDeleteSolicitacao(s.status));
  const anyOpen = selected.some((s) => s.status === 'Aberta');

  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3 p-3 rounded-md border bg-muted/40">
      <span className="text-sm font-medium">
        {count} {count === 1 ? 'selecionada' : 'selecionadas'}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {canChangeStatus && allowedBulkStatuses.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isMutating}>
                Alterar status
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Mudar para</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allowedBulkStatuses.map((s) => (
                <DropdownMenuItem key={s} onSelect={() => onChangeStatus(s)}>{s}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {anyOpen && (
          <Button variant="outline" size="sm" onClick={onRefreshCosts} disabled={isMutating} aria-label="Atualizar custos das selecionadas">
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar custos
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={onExport} disabled={isExporting} aria-label="Exportar selecionadas em XLSX">
          {isExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          Exportar XLSX
        </Button>

        <Button variant="outline" size="sm" onClick={onExportPdf} disabled={isExportingPdf} aria-label="Exportar selecionadas em PDF consolidado">
          {isExportingPdf ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
          Exportar PDF
        </Button>

        {allDeletable && (
          <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={isMutating}>
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir {count} BOM{count === 1 ? '' : 's'}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação remove as BOMs selecionadas e todos os seus itens. Não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <Button variant="ghost" size="sm" onClick={onClear} aria-label="Limpar seleção">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, Lock, ArchiveRestore, Trash2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeleteBomVersion, useObsoleteBomVersion, useReleaseBomVersion } from '@/hooks/useBomTree';
import type { BomVersion, BomVersionStatus } from '@/types/bom';
import { toast } from 'sonner';
import { NewVersionDialog } from './NewVersionDialog';

const statusColor: Record<BomVersionStatus, string> = {
  DRAFT: 'bg-warning text-warning-foreground',
  RELEASED: 'bg-success text-success-foreground',
  OBSOLETE: 'bg-muted text-muted-foreground',
};

interface Props {
  rootId: string;
  versions: BomVersion[];
  selectedId: string | undefined;
  onSelect: (versionId: string) => void;
}

export function VersionPanel({ rootId, versions, selectedId, onSelect }: Props) {
  const { canReleaseBomVersion, canEditBomDraft, canDeleteObsoleteVersion } = usePermissions();
  const [newOpen, setNewOpen] = useState(false);
  const release = useReleaseBomVersion();
  const obsolete = useObsoleteBomVersion();
  const deleteVersion = useDeleteBomVersion();

  const current = versions.find((v) => v.id === selectedId);
  const maxVersionNumber = Math.max(...versions.map((v) => v.version_number));

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={selectedId} onValueChange={onSelect}>
        <SelectTrigger className="w-[260px]">
          <SelectValue placeholder="Selecionar versão…" />
        </SelectTrigger>
        <SelectContent>
          {versions.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              v{v.version_number} {v.label ? `— ${v.label}` : ''} ({v.status})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {current && (
        <Badge className={statusColor[current.status]}>{current.status}</Badge>
      )}

      {canEditBomDraft && (
        <Button variant="outline" size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nova versão
        </Button>
      )}

      {current?.status === 'DRAFT' && canReleaseBomVersion && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="default" size="sm">
              <Lock className="h-3.5 w-3.5 mr-1" /> Liberar (RELEASED)
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Liberar versão?</AlertDialogTitle>
              <AlertDialogDescription>
                A versão atual passa a ser RELEASED. Qualquer outra versão RELEASED deste Conjunto
                será marcada como OBSOLETE automaticamente. Após a liberação, esta versão fica imutável.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await release.mutateAsync({ rootId, versionId: current.id });
                    toast.success(`v${current.version_number} liberada`);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Erro ao liberar');
                  }
                }}
              >
                Liberar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {current && current.status !== 'OBSOLETE' && canReleaseBomVersion && (
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            try {
              await obsolete.mutateAsync({ rootId, versionId: current.id });
              toast.success('Versão marcada como OBSOLETE');
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Erro');
            }
          }}
        >
          <ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Marcar OBSOLETE
        </Button>
      )}

      {current?.status === 'OBSOLETE' &&
        current.version_number === maxVersionNumber &&
        canDeleteObsoleteVersion && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Deletar versão
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deletar versão OBSOLETE?</AlertDialogTitle>
                <AlertDialogDescription>
                  A versão v{current.version_number} será removida permanentemente junto com todos
                  os seus nós. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    try {
                      await deleteVersion.mutateAsync({ rootId, versionId: current.id });
                      const remaining = versions.filter((v) => v.id !== current.id);
                      if (remaining.length > 0) {
                        onSelect(remaining[remaining.length - 1].id);
                      }
                      toast.success(`v${current.version_number} deletada`);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Erro ao deletar versão');
                    }
                  }}
                >
                  Deletar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

      <NewVersionDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        rootId={rootId}
        versions={versions}
        defaultSourceId={current?.id}
        onCreated={(id) => onSelect(id)}
      />
    </div>
  );
}

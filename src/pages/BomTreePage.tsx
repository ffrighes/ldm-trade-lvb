import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Copy, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useProjects } from '@/hooks/useSupabaseData';
import { useBomRoots, useBomVersions, useDeleteBomRoot } from '@/hooks/useBomTree';
import { usePermissions } from '@/hooks/usePermissions';
import { CreateConjuntoDialog } from '@/components/bom/CreateConjuntoDialog';
import { EditConjuntoDialog } from '@/components/bom/EditConjuntoDialog';
import { CloneFromProjectDialog } from '@/components/bom/CloneFromProjectDialog';
import { BomTreeView } from '@/components/bom/BomTreeView';
import { VersionPanel } from '@/components/bom/VersionPanel';
import { BomNodeIcon } from '@/components/bom/BomNodeIcon';

export default function BomTreePage() {
  const { projetoId } = useParams<{ projetoId: string }>();
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const { data: roots = [], isLoading: rootsLoading } = useBomRoots(projetoId);

  const { canEditBomDraft, canCloneBom, canDeleteBomRoot } = usePermissions();
  const deleteRoot = useDeleteBomRoot();

  const [selectedRootId, setSelectedRootId] = useState<string | undefined>();
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [openCreate, setOpenCreate] = useState(false);
  const [openClone, setOpenClone] = useState(false);
  const [confirmDeleteRootId, setConfirmDeleteRootId] = useState<string | null>(null);
  const [editRootId, setEditRootId] = useState<string | null>(null);

  const { data: versions = [] } = useBomVersions(selectedRootId);

  const projeto = useMemo(
    () => (projects as Array<{ id: string; numero: string; descricao: string }>).find((p) => p.id === projetoId) ?? null,
    [projects, projetoId],
  );

  // Auto-select first root and best version (RELEASED preferred, else most recent).
  useEffect(() => {
    if (!selectedRootId && roots.length > 0) setSelectedRootId(roots[0].id);
  }, [roots, selectedRootId]);

  useEffect(() => {
    if (!versions.length) { setSelectedVersionId(undefined); return; }
    if (selectedVersionId && versions.some((v) => v.id === selectedVersionId)) return;
    const released = versions.find((v) => v.status === 'RELEASED');
    setSelectedVersionId((released ?? versions[0]).id);
  }, [versions, selectedVersionId]);

  if (!projetoId) return <Navigate to="/projetos" replace />;

  const currentRoot = roots.find((r) => r.id === selectedRootId);
  const currentVersion = versions.find((v) => v.id === selectedVersionId);
  const isReadOnly = !canEditBomDraft || !currentVersion || currentVersion.status !== 'DRAFT';

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => navigate('/projetos')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="text-sm text-muted-foreground">
          Projetos / {projeto ? `${projeto.numero} - ${projeto.descricao}` : '…'} / BOMs
        </div>
      </div>

      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Estrutura de Produto (BOMs)</h1>
        <div className="flex items-center gap-2">
          {canCloneBom && (
            <Button variant="outline" onClick={() => setOpenClone(true)}>
              <Copy className="h-4 w-4 mr-2" /> Clonar de outro projeto
            </Button>
          )}
          {canEditBomDraft && (
            <Button onClick={() => setOpenCreate(true)}>
              <Plus className="h-4 w-4 mr-2" /> Novo Conjunto
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Conjuntos</CardTitle></CardHeader>
          <CardContent className="p-2">
            {rootsLoading ? (
              <p className="text-sm text-muted-foreground p-2">Carregando…</p>
            ) : roots.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">Nenhum Conjunto neste projeto.</p>
            ) : (
              <ul className="space-y-1">
                {roots.map((r) => (
                  <li key={r.id} className="group flex items-center gap-1">
                    <button
                      className={`flex-1 text-left px-2 py-1.5 rounded hover:bg-muted text-sm flex items-start gap-2 min-w-0 ${
                        r.id === selectedRootId ? 'bg-muted font-medium' : ''
                      }`}
                      onClick={() => { setSelectedRootId(r.id); setSelectedVersionId(undefined); }}
                    >
                      <span className="pt-0.5"><BomNodeIcon type="CONJUNTO" /></span>
                      <span className="flex-1 min-w-0 flex flex-col">
                        <span className="font-mono text-xs text-muted-foreground">{r.codigo}</span>
                        <span className="break-words">{r.name}</span>
                      </span>
                    </button>
                    {canEditBomDraft && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Editar descrição do Conjunto ${r.codigo}`}
                        title="Editar descrição"
                        onClick={(e) => { e.stopPropagation(); setEditRootId(r.id); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canDeleteBomRoot && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Excluir Conjunto ${r.codigo}`}
                        title="Excluir Conjunto"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteRootId(r.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            {currentRoot ? (
              <>
                <CardTitle className="flex items-center gap-2">
                  <BomNodeIcon type="CONJUNTO" />
                  <span className="font-mono text-sm text-muted-foreground">{currentRoot.codigo}</span>
                  <span>{currentRoot.name}</span>
                </CardTitle>
                <VersionPanel
                  rootId={currentRoot.id}
                  versions={versions}
                  selectedId={selectedVersionId}
                  onSelect={setSelectedVersionId}
                />
                <div className="pt-1">
                  <Input
                    placeholder="Buscar nó por nome ou item…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-md"
                  />
                </div>
              </>
            ) : (
              <CardTitle className="text-base text-muted-foreground">
                Selecione ou crie um Conjunto para começar.
              </CardTitle>
            )}
          </CardHeader>
          <CardContent>
            {currentVersion ? (
              <BomTreeView versionId={currentVersion.id} readOnly={isReadOnly} search={search} />
            ) : currentRoot ? (
              <p className="text-muted-foreground py-6">Sem versões neste Conjunto.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <CreateConjuntoDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        projectId={projetoId}
        onCreated={(rootId, versionId) => { setSelectedRootId(rootId); setSelectedVersionId(versionId); }}
      />
      <EditConjuntoDialog
        open={!!editRootId}
        onOpenChange={(o) => { if (!o) setEditRootId(null); }}
        projectId={projetoId}
        rootId={editRootId}
        codigo={roots.find((r) => r.id === editRootId)?.codigo ?? ''}
        currentName={roots.find((r) => r.id === editRootId)?.name ?? ''}
      />
      <CloneFromProjectDialog
        open={openClone}
        onOpenChange={setOpenClone}
        targetProjectId={projetoId}
        onCloned={(rootId, versionId) => { setSelectedRootId(rootId); setSelectedVersionId(versionId); }}
      />

      <AlertDialog
        open={!!confirmDeleteRootId}
        onOpenChange={(o) => { if (!o) setConfirmDeleteRootId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conjunto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o Conjunto, todas as suas versões (incluindo RELEASED e
              OBSOLETE) e todos os nós da estrutura. A operação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDeleteRootId) return;
                const id = confirmDeleteRootId;
                try {
                  await deleteRoot.mutateAsync({ rootId: id, projectId: projetoId });
                  toast.success('Conjunto excluído');
                  if (selectedRootId === id) {
                    setSelectedRootId(undefined);
                    setSelectedVersionId(undefined);
                  }
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Erro ao excluir');
                } finally {
                  setConfirmDeleteRootId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Copy, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useProjects, useMaterials } from '@/hooks/useSupabaseData';
import { useBomRoots, useBomVersions, useBomNodes, buildBomTree } from '@/hooks/useBomTree';
import { usePermissions } from '@/hooks/usePermissions';
import { CreateConjuntoDialog } from '@/components/bom/CreateConjuntoDialog';
import { CloneFromProjectDialog } from '@/components/bom/CloneFromProjectDialog';
import { BomTreeView } from '@/components/bom/BomTreeView';
import { VersionPanel } from '@/components/bom/VersionPanel';
import { BomNodeIcon } from '@/components/bom/BomNodeIcon';
import { exportConjuntoPdf } from '@/lib/exportConjuntoPdf';

export default function BomTreePage() {
  const { projetoId } = useParams<{ projetoId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: projects = [] } = useProjects();
  const { data: roots = [] } = useBomRoots(projetoId);
  const { data: materials = [] } = useMaterials();

  const { canEditBomDraft, canCloneBom } = usePermissions();

  const selectedRootId = searchParams.get('rootId') ?? undefined;
  const selectedVersionId = searchParams.get('versionId') ?? undefined;

  const [search, setSearch] = useState('');
  const [openCreate, setOpenCreate] = useState(false);
  const [openClone, setOpenClone] = useState(false);

  const { data: versions = [] } = useBomVersions(selectedRootId);
  const { data: nodes = [] } = useBomNodes(selectedVersionId);

  const projeto = useMemo(
    () => (projects as Array<{ id: string; numero: string; descricao: string }>).find((p) => p.id === projetoId) ?? null,
    [projects, projetoId],
  );

  const setSelection = (rootId?: string, versionId?: string) => {
    const next = new URLSearchParams(searchParams);
    if (rootId) next.set('rootId', rootId); else next.delete('rootId');
    if (versionId) next.set('versionId', versionId); else next.delete('versionId');
    setSearchParams(next, { replace: true });
  };

  // Auto-select first root if none is selected.
  useEffect(() => {
    if (!selectedRootId && roots.length > 0) {
      const next = new URLSearchParams(searchParams);
      next.set('rootId', roots[0].id);
      setSearchParams(next, { replace: true });
    }
  }, [roots, selectedRootId, searchParams, setSearchParams]);

  // Auto-select best version (RELEASED preferred, else most recent).
  useEffect(() => {
    if (!versions.length) {
      if (selectedVersionId) {
        const next = new URLSearchParams(searchParams);
        next.delete('versionId');
        setSearchParams(next, { replace: true });
      }
      return;
    }
    if (selectedVersionId && versions.some((v) => v.id === selectedVersionId)) return;
    const released = versions.find((v) => v.status === 'RELEASED');
    const next = new URLSearchParams(searchParams);
    next.set('versionId', (released ?? versions[0]).id);
    setSearchParams(next, { replace: true });
  }, [versions, selectedVersionId, searchParams, setSearchParams]);

  if (!projetoId) return <Navigate to="/projetos" replace />;

  const currentRoot = roots.find((r) => r.id === selectedRootId);
  const currentVersion = versions.find((v) => v.id === selectedVersionId);
  const isReadOnly = !canEditBomDraft || !currentVersion || currentVersion.status !== 'DRAFT';

  const handleExportPdf = () => {
    if (!currentRoot || !currentVersion || nodes.length === 0) return;
    const tree = buildBomTree(nodes);
    if (!tree) return;
    const matMap = new Map((materials ?? []).map((m) => [m.id, m]));
    exportConjuntoPdf(currentRoot, currentVersion, tree, matMap);
  };

  const handleSelectVersion = (versionId: string) => setSelection(selectedRootId, versionId);

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

      <Card>
        <CardHeader className="space-y-2">
          {currentRoot ? (
            <>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BomNodeIcon type="CONJUNTO" />
                  <span className="font-mono text-sm text-muted-foreground">{currentRoot.codigo}</span>
                  <span>{currentRoot.name}</span>
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={!currentVersion || nodes.length === 0}
                  title="Exportar PDF"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  PDF
                </Button>
              </div>
              <VersionPanel
                rootId={currentRoot.id}
                versions={versions}
                selectedId={selectedVersionId}
                onSelect={handleSelectVersion}
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
          {currentVersion && currentRoot ? (
            <BomTreeView
              versionId={currentVersion.id}
              projectId={projetoId}
              rootId={currentRoot.id}
              readOnly={isReadOnly}
              search={search}
            />
          ) : currentRoot ? (
            <p className="text-muted-foreground py-6">Sem versões neste Conjunto.</p>
          ) : null}
        </CardContent>
      </Card>

      <CreateConjuntoDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        projectId={projetoId}
        onCreated={(rootId, versionId) => setSelection(rootId, versionId)}
      />
      <CloneFromProjectDialog
        open={openClone}
        onOpenChange={setOpenClone}
        targetProjectId={projetoId}
        onCloned={(rootId, versionId) => setSelection(rootId, versionId)}
      />
    </div>
  );
}

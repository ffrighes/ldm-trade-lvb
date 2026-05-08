import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useProjects } from '@/hooks/useSupabaseData';
import { useBomRoots, useBomVersions } from '@/hooks/useBomTree';
import { usePermissions } from '@/hooks/usePermissions';
import { CreateConjuntoDialog } from '@/components/bom/CreateConjuntoDialog';
import { CloneFromProjectDialog } from '@/components/bom/CloneFromProjectDialog';
import { BomTreeView } from '@/components/bom/BomTreeView';
import { VersionPanel } from '@/components/bom/VersionPanel';
import { BomNodeIcon } from '@/components/bom/BomNodeIcon';

export default function BomTreePage() {
  const { projetoId } = useParams<{ projetoId: string }>();
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const { data: roots = [], isLoading: rootsLoading } = useBomRoots(projetoId);

  const { canEditBomDraft, canCloneBom } = usePermissions();

  const [selectedRootId, setSelectedRootId] = useState<string | undefined>();
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [openCreate, setOpenCreate] = useState(false);
  const [openClone, setOpenClone] = useState(false);

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
                  <li key={r.id}>
                    <button
                      className={`w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm flex items-center gap-2 ${
                        r.id === selectedRootId ? 'bg-muted font-medium' : ''
                      }`}
                      onClick={() => { setSelectedRootId(r.id); setSelectedVersionId(undefined); }}
                    >
                      <BomNodeIcon type="CONJUNTO" />
                      <span className="truncate">
                        <span className="font-mono text-xs text-muted-foreground">{r.codigo}</span>{' '}
                        {r.name}
                      </span>
                    </button>
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
      <CloneFromProjectDialog
        open={openClone}
        onOpenChange={setOpenClone}
        targetProjectId={projetoId}
        onCloned={(rootId, versionId) => { setSelectedRootId(rootId); setSelectedVersionId(versionId); }}
      />
    </div>
  );
}

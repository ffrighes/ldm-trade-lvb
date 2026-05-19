import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Copy, CopyPlus, FileText, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useProjects, useMaterials } from '@/hooks/useSupabaseData';
import { useBomRoots, useBomVersions, useBomNodes, buildBomTree } from '@/hooks/useBomTree';
import { usePermissions } from '@/hooks/usePermissions';
import { CreateConjuntoDialog } from '@/components/bom/CreateConjuntoDialog';
import { CloneFromProjectDialog } from '@/components/bom/CloneFromProjectDialog';
import { CopyConjuntoDialog } from '@/components/bom/CopyConjuntoDialog';
import { ExportXlsxDialog } from '@/components/bom/ExportXlsxDialog';
import { BomTreeView } from '@/components/bom/BomTreeView';
import { VersionPanel } from '@/components/bom/VersionPanel';
import { BomNodeIcon } from '@/components/bom/BomNodeIcon';
import { RootQuantityField } from '@/components/bom/RootQuantityField';
import { exportConjuntoPdf, type ExportChildData } from '@/lib/exportConjuntoPdf';
import { exportConjuntoXlsx } from '@/lib/exportConjuntoXlsx';
import { supabase } from '@/integrations/supabase/client';
import type { BomNode, BomRoot, BomTreeNode, BomVersion } from '@/types/bom';

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
  const [openCopy, setOpenCopy] = useState(false);
  const [xlsxDialogOpen, setXlsxDialogOpen] = useState(false);
  const [xlsxDialogData, setXlsxDialogData] = useState<{
    tree: BomTreeNode;
    childConjuntos: ExportChildData[];
    availableCategories: string[];
  } | null>(null);

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

  function collectAllRootIds(children: ExportChildData[]): string[] {
    const ids: string[] = [];
    for (const c of children) {
      ids.push(c.root.id);
      ids.push(...collectAllRootIds(c.children));
    }
    return ids;
  }

  function collectAvailableCategories(
    tree: BomTreeNode,
    childConjuntos: ExportChildData[],
    matMap: Map<string, { id: string; categoria?: string | null }>,
  ): string[] {
    const CANONICAL = ['Tubulação', 'Conexões', 'Válvulas', 'Fixadores', 'Instrumentos'];
    const SEM_CAT = '(Sem categoria)';
    const found = new Set<string>();

    function walk(node: BomTreeNode) {
      if (node.node_type === 'ITEM' && node.material_id) {
        const mat = matMap.get(node.material_id);
        found.add(mat?.categoria ?? SEM_CAT);
      } else if (node.node_type === 'ITEM') {
        found.add(SEM_CAT);
      }
      node.children.forEach(walk);
    }

    walk(tree);
    for (const child of childConjuntos) {
      walk(child.tree);
      collectAvailableCategories(child.tree, child.children, matMap)
        .forEach((c) => found.add(c));
    }

    const ordered: string[] = [];
    for (const c of CANONICAL) if (found.has(c)) ordered.push(c);
    const unknown = [...found]
      .filter((c) => !CANONICAL.includes(c) && c !== SEM_CAT)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    ordered.push(...unknown);
    if (found.has(SEM_CAT)) ordered.push(SEM_CAT);
    return ordered;
  }

  async function fetchDescendantConjuntos(
    parentRoot: BomRoot,
    allRoots: BomRoot[],
    breadcrumb: string[],
  ): Promise<ExportChildData[]> {
    const sb = supabase as unknown as {
      from: (t: string) => {
        select: (q: string) => {
          eq: (col: string, val: unknown) => {
            order: (col: string, opts?: { ascending: boolean }) => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
    };

    const directChildren = allRoots.filter((r) => r.parent_id === parentRoot.id);
    const result: ExportChildData[] = [];

    for (const childRoot of directChildren) {
      const { data: vData, error: vErr } = await sb
        .from('bom_version')
        .select('*')
        .eq('root_id', childRoot.id)
        .order('version_number', { ascending: false });
      if (vErr) throw vErr;

      const versions = (vData ?? []) as BomVersion[];
      if (versions.length === 0) continue;
      const bestVersion = versions.find((v) => v.status === 'RELEASED') ?? versions[0];

      const { data: nData, error: nErr } = await sb
        .from('bom_node')
        .select('*')
        .eq('version_id', bestVersion.id)
        .order('position');
      if (nErr) throw nErr;

      const childTree = buildBomTree((nData ?? []) as BomNode[]);
      if (!childTree) continue;

      const childLabel = `${childRoot.codigo} — ${childRoot.name}`;
      const grandchildren = await fetchDescendantConjuntos(
        childRoot,
        allRoots,
        [...breadcrumb, childLabel],
      );
      result.push({ root: childRoot, version: bestVersion, tree: childTree, breadcrumb, children: grandchildren, quantityInParent: childRoot.quantity_in_parent ?? 1 });
    }

    return result;
  }

  const currentRoot = roots.find((r) => r.id === selectedRootId);
  const currentVersion = versions.find((v) => v.id === selectedVersionId);
  const isReadOnly = !canEditBomDraft || !currentVersion || currentVersion.status !== 'DRAFT';

  const handleExportPdf = async () => {
    if (!currentRoot || !currentVersion || nodes.length === 0 || !projeto) return;
    const tree = buildBomTree(nodes);
    if (!tree) return;
    const matMap = new Map((materials ?? []).map((m) => [m.id, m]));

    try {
      const rootLabel = `${currentRoot.codigo} — ${currentRoot.name}`;
      const childConjuntos = await fetchDescendantConjuntos(currentRoot, roots, [rootLabel]);
      exportConjuntoPdf(currentRoot, currentVersion, tree, matMap, childConjuntos, projeto);
    } catch (err) {
      toast.error('Erro ao gerar PDF: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleExportXlsx = async () => {
    if (!currentRoot || !currentVersion || nodes.length === 0) return;
    const tree = buildBomTree(nodes);
    if (!tree) return;
    const matMap = new Map((materials ?? []).map((m) => [m.id, m]));
    try {
      const rootLabel = `${currentRoot.codigo} — ${currentRoot.name}`;
      const childConjuntos = await fetchDescendantConjuntos(currentRoot, roots, [rootLabel]);
      const availableCategories = collectAvailableCategories(tree, childConjuntos, matMap);
      setXlsxDialogData({ tree, childConjuntos, availableCategories });
      setXlsxDialogOpen(true);
    } catch (err) {
      toast.error('Erro ao preparar exportação: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleConfirmXlsxExport = (selection: {
    selectedRootIds: Set<string>;
    selectedCategories: Set<string>;
  }) => {
    if (!currentRoot || !currentVersion || !xlsxDialogData) return;
    const matMap = new Map((materials ?? []).map((m) => [m.id, m]));

    const allRootIds = new Set<string>([
      currentRoot.id,
      ...collectAllRootIds(xlsxDialogData.childConjuntos),
    ]);
    const allCategoriesSet = new Set(xlsxDialogData.availableCategories);

    const isPartial =
      selection.selectedRootIds.size !== allRootIds.size ||
      selection.selectedCategories.size !== allCategoriesSet.size;

    try {
      exportConjuntoXlsx(
        currentRoot,
        currentVersion,
        xlsxDialogData.tree,
        matMap,
        xlsxDialogData.childConjuntos,
        projeto ? { numero: projeto.numero, descricao: projeto.descricao } : undefined,
        {
          selectedRootIds: selection.selectedRootIds,
          selectedCategories: selection.selectedCategories,
          isPartial,
          totalAvailableCategories: allCategoriesSet.size,
        },
      );
    } catch (err) {
      toast.error('Erro ao gerar XLSX: ' + (err instanceof Error ? err.message : String(err)));
    }
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportPdf}
                    disabled={!currentVersion || nodes.length === 0 || !projeto}
                    title="Exportar PDF"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportXlsx}
                    disabled={!currentVersion || nodes.length === 0}
                    title="Exportar XLSX"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1" />
                    XLSX
                  </Button>
                </div>
              </div>
              <VersionPanel
                rootId={currentRoot.id}
                versions={versions}
                selectedId={selectedVersionId}
                onSelect={handleSelectVersion}
              />
              {currentRoot.parent_id != null && (
                <RootQuantityField
                  root={currentRoot}
                  projectId={projetoId}
                  canEdit={canEditBomDraft}
                />
              )}
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
      {currentRoot && currentVersion && xlsxDialogData && (
        <ExportXlsxDialog
          open={xlsxDialogOpen}
          onOpenChange={setXlsxDialogOpen}
          root={currentRoot}
          version={currentVersion}
          descendants={xlsxDialogData.childConjuntos}
          availableCategories={xlsxDialogData.availableCategories}
          onConfirm={handleConfirmXlsxExport}
        />
      )}
    </div>
  );
}

import { useMemo, useState, useEffect, useRef } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ChevronDown, ChevronRight, MoreVertical, Package, FolderPlus, Edit3, Copy, Trash2, ArrowUp, ArrowDown, Check, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useMaterials } from '@/hooks/useSupabaseData';
import {
  buildBomTree, useAddBomNode, useBomNodes, useDuplicateBomSubtree, useMoveBomNode,
  useRemoveBomSubtree, useUpdateBomNode,
} from '@/hooks/useBomTree';
import type { BomTreeNode } from '@/types/bom';
import { BomNodeIcon, bomNodeTypeLabel } from './BomNodeIcon';
import { CreateConjuntoDialog } from './CreateConjuntoDialog';
import { EditNodeDialog } from './EditNodeDialog';
import { SelectCategoryDialog } from './SelectCategoryDialog';
import { SEM_CATEGORIA_LABEL } from '@/lib/categorias';
import { useCategorias } from '@/hooks/useCategorias';

type DraftEntry = { id: string; categoria: string };

interface MaterialLite {
  id: string;
  descricao: string;
  bitola: string;
  unidade: string;
  categoria?: string | null;
  erp?: string | null;
  notas?: string | null;
}

interface Props {
  versionId: string;
  projectId: string;
  rootId: string;
  readOnly: boolean;
  search?: string;
}

export function BomTreeView({ versionId, projectId, rootId, readOnly, search = '' }: Props) {
  const { data: nodes = [], isLoading } = useBomNodes(versionId);
  const { data: materials = [] } = useMaterials();
  const { data: categorias = [] } = useCategorias();
  const tree = useMemo(() => buildBomTree(nodes), [nodes]);
  const move = useMoveBomNode();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!tree) return;
    const ids = new Set<string>();
    const collect = (n: BomTreeNode) => {
      if (n.children.length > 0) { ids.add(n.id); n.children.forEach(collect); }
    };
    collect(tree);
    setExpanded(ids);
  }, [tree?.id]);

  const [showCumulative, setShowCumulative] = useState(false);
  const [openChildConjunto, setOpenChildConjunto] = useState(false);
  const [selectCategoryOpen, setSelectCategoryOpen] = useState(false);
  const [editNode, setEditNode] = useState<BomTreeNode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BomTreeNode | null>(null);
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, DraftEntry[]>>({});
  const [pendingAutoOpen, setPendingAutoOpen] = useState<string | null>(null);

  const toggleItemEdit = (nodeId: string) =>
    setEditingItems((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });

  const openItemEdit = (nodeId: string) => {
    setEditingItems((prev) => new Set(prev).add(nodeId));
    setPendingAutoOpen(nodeId);
  };

  useEffect(() => {
    if (!pendingAutoOpen) return;
    const el = document.querySelector(`[data-item-id="${pendingAutoOpen}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const firstInput = el.querySelector<HTMLElement>('[data-autofocus]');
    firstInput?.focus();
    setPendingAutoOpen(null);
  }, [pendingAutoOpen, nodes]);

  const addDraft = (parentId: string, categoria: string) => {
    setDrafts((prev) => {
      const list = prev[parentId] ?? [];
      const newId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return { ...prev, [parentId]: [...list, { id: newId, categoria }] };
    });
    setExpanded((p) => new Set(p).add(parentId));
  };

  const removeDraft = (parentId: string, draftId: string) => {
    setDrafts((prev) => {
      const list = (prev[parentId] ?? []).filter((d) => d.id !== draftId);
      const next = { ...prev };
      if (list.length === 0) delete next[parentId];
      else next[parentId] = list;
      return next;
    });
  };

  const matById = useMemo(() => {
    const m = new Map<string, MaterialLite>();
    for (const x of materials as MaterialLite[]) m.set(x.id, x);
    return m;
  }, [materials]);

  const categoriaOrder = useMemo(() => categorias as string[], [categorias]);

  const rootCategoryList = useMemo(() => {
    const set = new Set<string>(categoriaOrder);
    if (tree) {
      for (const item of tree.children.filter((c) => c.node_type === 'ITEM')) {
        const mat = item.material_id ? matById.get(item.material_id) : null;
        const cat = (mat?.categoria || '').trim();
        if (cat && cat !== SEM_CATEGORIA_LABEL) set.add(cat);
      }
    }
    return [...set];
  }, [categoriaOrder, tree, matById]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || !e.active || readOnly) return;
    const draggedId = String(e.active.id);
    const targetId = String(e.over.id);
    if (draggedId === targetId) return;

    const map = new Map<string, BomTreeNode>();
    const walk = (n: BomTreeNode) => { map.set(n.id, n); n.children.forEach(walk); };
    if (tree) walk(tree);
    const target = map.get(targetId);
    const dragged = map.get(draggedId);
    if (!target || !dragged) return;
    if (target.node_type === 'ITEM') {
      toast.error('Items não podem ter filhos'); return;
    }
    // Trigger handles cycle/depth; client-side guard for the obvious case:
    if (dragged.node_type === 'CONJUNTO') {
      toast.error('O Conjunto raiz não pode ser movido'); return;
    }
    const newPos = (target.children?.length ?? 0);
    try {
      await move.mutateAsync({ versionId, nodeId: draggedId, newParentId: targetId, newPosition: newPos });
      setExpanded((p) => new Set(p).add(targetId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao mover');
    }
  };

  const matchesSearch = (n: BomTreeNode): boolean => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    if ((n.name ?? '').toLowerCase().includes(q)) return true;
    if (n.material_id) {
      const m = matById.get(n.material_id);
      if (m && (`${m.descricao} ${m.bitola}`).toLowerCase().includes(q)) return true;
    }
    return n.children.some(matchesSearch);
  };

  if (isLoading) return <div className="text-muted-foreground py-6">Carregando estrutura…</div>;
  if (!tree) return <div className="text-muted-foreground py-6">Sem nós nesta versão.</div>;

  const rootAssemblyChildren = tree.children.filter((c) => c.node_type !== 'ITEM');
  const rootItemChildren = tree.children.filter((c) => c.node_type === 'ITEM');
  const rootDrafts = drafts[tree.id] ?? [];
  const hasContent =
    rootAssemblyChildren.length > 0 || rootItemChildren.length > 0 || rootDrafts.length > 0;

  const handleAdd = (pid: string, tab: 'item' | 'subconjunto') => {
    if (tab === 'item') addDraft(pid, SEM_CATEGORIA_LABEL);
    else setOpenChildConjunto(true);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{Math.max(0, nodes.length - 1)} nó(s)</span>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectCategoryOpen(true)}
                title="Adicionar item"
              >
                <Package className="h-3.5 w-3.5 mr-1" /> Adicionar item
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpenChildConjunto(true)}
                title="Adicionar Conjunto filho"
              >
                <FolderPlus className="h-3.5 w-3.5 mr-1" /> Conjunto filho
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCumulative((v) => !v)}
            title="Alternar quantidade acumulada"
          >
            {showCumulative ? 'Mostrar qtd. unitária' : 'Mostrar qtd. acumulada'}
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="border rounded-md p-2 bg-card">
          {hasContent ? (
            <>
              {rootAssemblyChildren.map((c, i) => (
                <NodeRow
                  key={c.id}
                  node={c}
                  depth={0}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  matById={matById}
                  materials={materials as MaterialLite[]}
                  categoriaOrder={categoriaOrder}
                  readOnly={readOnly}
                  showCumulative={showCumulative}
                  editingItems={editingItems}
                  onToggleItemEdit={toggleItemEdit}
                  onOpenItemEdit={openItemEdit}
                  drafts={drafts}
                  onAddDraft={addDraft}
                  onRemoveDraft={removeDraft}
                  onAdd={handleAdd}
                  onEdit={(n) => setEditNode(n)}
                  onDelete={(n) => setConfirmDelete(n)}
                  visible={matchesSearch(c)}
                  search={search}
                  siblings={rootAssemblyChildren.length}
                  siblingIndex={i}
                />
              ))}
              {(rootItemChildren.length > 0 || rootDrafts.length > 0) && (
                <ItemsByCategoryTable
                  parentId={tree.id}
                  versionId={tree.version_id}
                  items={rootItemChildren}
                  drafts={rootDrafts}
                  depth={0}
                  matById={matById}
                  materials={materials as MaterialLite[]}
                  categoriaOrder={categoriaOrder}
                  readOnly={readOnly}
                  showCumulative={showCumulative}
                  editingItems={editingItems}
                  onToggleItemEdit={toggleItemEdit}
                  onOpenItemEdit={openItemEdit}
                  onAddDraft={addDraft}
                  onRemoveDraft={removeDraft}
                  onDelete={(n) => setConfirmDelete(n)}
                />
              )}
            </>
          ) : (
            <div className="text-muted-foreground text-sm py-6 text-center">
              Conjunto vazio. Adicione um item ou Conjunto filho.
            </div>
          )}
        </div>
      </DndContext>

      <CreateConjuntoDialog
        open={openChildConjunto}
        onOpenChange={setOpenChildConjunto}
        projectId={projectId}
        defaultParentId={rootId}
      />
      <SelectCategoryDialog
        open={selectCategoryOpen}
        categories={rootCategoryList}
        onCancel={() => setSelectCategoryOpen(false)}
        onConfirm={(category) => {
          setSelectCategoryOpen(false);
          addDraft(tree.id, category);
        }}
      />
      <EditNodeDialog open={!!editNode} onOpenChange={(o) => { if (!o) setEditNode(null); }} node={editNode} />
      <DeleteConfirm node={confirmDelete} versionId={versionId} onClose={() => setConfirmDelete(null)} />
    </>
  );
}

interface RowProps {
  node: BomTreeNode;
  depth: number;
  expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  matById: Map<string, MaterialLite>;
  materials: MaterialLite[];
  categoriaOrder: string[];
  readOnly: boolean;
  showCumulative: boolean;
  editingItems: Set<string>;
  onToggleItemEdit: (nodeId: string) => void;
  onOpenItemEdit: (nodeId: string) => void;
  drafts: Record<string, DraftEntry[]>;
  onAddDraft: (parentId: string, categoria: string) => void;
  onRemoveDraft: (parentId: string, draftId: string) => void;
  onAdd: (parentId: string, defaultTab: 'item' | 'subconjunto') => void;
  onEdit: (n: BomTreeNode) => void;
  onDelete: (n: BomTreeNode) => void;
  visible: boolean;
  search: string;
  siblings: number;
  siblingIndex: number;
}

export function NodeRow(props: RowProps) {
  const {
    node, depth, expanded, setExpanded, matById, materials, categoriaOrder,
    readOnly, showCumulative, editingItems, onToggleItemEdit, onOpenItemEdit,
    drafts, onAddDraft, onRemoveDraft, onAdd, onEdit, onDelete, search,
  } = props;
  const isOpen = expanded.has(node.id) || (search.trim().length > 0);
  const hasChildren = node.children.length > 0;
  const isItem = node.node_type === 'ITEM';
  const isConjunto = node.node_type === 'CONJUNTO';
  const isSubconjunto = node.node_type === 'SUBCONJUNTO';
  const [editingQty, setEditingQty] = useState(false);
  const [qtyDraft, setQtyDraft] = useState('');
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const itemChildren = useMemo(
    () => node.children.filter((c) => c.node_type === 'ITEM'),
    [node.children],
  );
  const assemblyChildren = useMemo(
    () => node.children.filter((c) => c.node_type !== 'ITEM'),
    [node.children],
  );

  const update = useUpdateBomNode();
  const duplicate = useDuplicateBomSubtree();

  const droppable = useDroppable({ id: node.id, disabled: readOnly || isItem });
  const draggable = useDraggable({ id: node.id, disabled: readOnly || isConjunto });

  const material = node.material_id ? matById.get(node.material_id) : null;
  const displayName = isItem
    ? (material ? `${material.descricao}${material.bitola ? ` — ${material.bitola}` : ''}` : '(item desconhecido)')
    : (node.name ?? '(sem nome)');
  const unit = isItem && material ? material.unidade : null;
  const qty = node.quantity ?? null;
  const cumQty = node.cumulativeQuantity;

  useEffect(() => {
    if (editingQty && qtyInputRef.current) {
      qtyInputRef.current.focus();
      qtyInputRef.current.select();
    }
  }, [editingQty]);

  const confirmQtyEdit = async () => {
    const num = parseFloat(qtyDraft);
    if (isNaN(num) || num <= 0) {
      toast.error('Quantidade deve ser maior que zero');
      return;
    }
    if (num === node.quantity) {
      setEditingQty(false);
      return;
    }
    try {
      await update.mutateAsync({ versionId: node.version_id, nodeId: node.id, quantity: num });
      toast.success('Quantidade atualizada');
      setEditingQty(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar quantidade');
    }
  };

  const toggle = () => setExpanded((p) => {
    const next = new Set(p);
    if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
    return next;
  });

  const moveSibling = async (delta: -1 | 1) => {
    try {
      await update.mutateAsync({
        versionId: node.version_id,
        nodeId: node.id,
        position: node.position + delta,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao mover');
    }
  };

  return (
    <div ref={droppable.setNodeRef} className={droppable.isOver ? 'rounded bg-primary/10' : ''}>
      <div
        className="group flex items-center gap-1 py-1.5 px-1 rounded hover:bg-muted/40"
        style={{ paddingLeft: `${depth * 18 + 4}px` }}
        ref={draggable.setNodeRef}
        {...draggable.attributes}
      >
        {hasChildren ? (
          <button onClick={toggle} className="p-0.5 hover:bg-muted rounded" aria-label="Expandir">
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="inline-block w-[18px]" />
        )}

        <span
          className={readOnly || isConjunto ? '' : 'cursor-grab'}
          {...(!readOnly && !isConjunto ? draggable.listeners : {})}
        >
          <BomNodeIcon type={node.node_type} />
        </span>

        <span className="font-medium truncate" title={displayName}>{displayName}</span>

        {!isConjunto && (
          isSubconjunto ? (
            editingQty ? (
              <>
                <Input
                  ref={qtyInputRef}
                  type="number"
                  min="0.000001"
                  step="any"
                  className="ml-2 h-7 w-24 font-mono text-xs"
                  value={qtyDraft}
                  aria-label="Nova quantidade"
                  title="Quantidade unitária deste subconjunto"
                  disabled={update.isPending}
                  onChange={(e) => setQtyDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); confirmQtyEdit(); }
                    if (e.key === 'Escape') { e.preventDefault(); setEditingQty(false); }
                  }}
                />
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-green-600"
                  aria-label="Confirmar quantidade" title="Confirmar"
                  disabled={update.isPending}
                  onClick={(e) => { e.stopPropagation(); confirmQtyEdit(); }}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  aria-label="Cancelar edição" title="Cancelar"
                  disabled={update.isPending}
                  onClick={(e) => { e.stopPropagation(); setEditingQty(false); }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                {qty != null && (
                  <Badge variant="outline" className="ml-2 font-mono text-xs"
                         title={showCumulative ? 'Quantidade acumulada' : 'Quantidade unitária'}>
                    {showCumulative ? cumQty : qty}{unit ? ` ${unit}` : ''}
                  </Badge>
                )}
                {!readOnly && (
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    aria-label="Editar quantidade" title="Editar quantidade"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQtyDraft(String(node.quantity ?? 1));
                      setEditingQty(true);
                    }}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )
          ) : (
            qty != null && (
              <Badge variant="outline" className="ml-2 font-mono text-xs"
                     title={showCumulative ? 'Quantidade acumulada' : 'Quantidade unitária'}>
                {showCumulative ? cumQty : qty}{unit ? ` ${unit}` : ''}
              </Badge>
            )
          )
        )}

        <Badge variant="secondary" className="ml-1 text-[10px]">
          {bomNodeTypeLabel(node.node_type)}
        </Badge>

        {!readOnly && !editingQty && (
          <div className="ml-auto flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            {!isItem && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Adicionar item"
                  onClick={(e) => { e.stopPropagation(); onAdd(node.id, 'item'); }}
                >
                  <Package className="h-3.5 w-3.5" />
                </Button>
                {isConjunto && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Adicionar Conjunto filho"
                    onClick={(e) => { e.stopPropagation(); onAdd(node.id, 'subconjunto'); }}
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onEdit(node)}>
                  <Edit3 className="h-3.5 w-3.5 mr-2" /> Editar
                </DropdownMenuItem>
                {!isConjunto && (
                  <>
                    <DropdownMenuItem onClick={() => moveSibling(-1)}>
                      <ArrowUp className="h-3.5 w-3.5 mr-2" /> Mover para cima
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => moveSibling(1)}>
                      <ArrowDown className="h-3.5 w-3.5 mr-2" /> Mover para baixo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        try {
                          await duplicate.mutateAsync({ versionId: node.version_id, nodeId: node.id });
                          toast.success('Subárvore duplicada');
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Erro ao duplicar');
                        }
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar subárvore
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(node)} className="text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {isOpen && (hasChildren || (!isItem && (drafts[node.id]?.length ?? 0) > 0)) && (
        <div>
          {assemblyChildren.map((c, i) => (
            <NodeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              expanded={expanded}
              setExpanded={setExpanded}
              matById={matById}
              materials={materials}
              categoriaOrder={categoriaOrder}
              readOnly={readOnly}
              showCumulative={showCumulative}
              editingItems={editingItems}
              onToggleItemEdit={onToggleItemEdit}
              onOpenItemEdit={onOpenItemEdit}
              drafts={drafts}
              onAddDraft={onAddDraft}
              onRemoveDraft={onRemoveDraft}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              visible
              search={search}
              siblings={assemblyChildren.length}
              siblingIndex={i}
            />
          ))}
          {!isItem && (itemChildren.length > 0 || (drafts[node.id]?.length ?? 0) > 0) && (
            <ItemsByCategoryTable
              parentId={node.id}
              versionId={node.version_id}
              items={itemChildren}
              drafts={drafts[node.id] ?? []}
              depth={depth + 1}
              matById={matById}
              materials={materials}
              categoriaOrder={categoriaOrder}
              readOnly={readOnly}
              showCumulative={showCumulative}
              editingItems={editingItems}
              onToggleItemEdit={onToggleItemEdit}
              onOpenItemEdit={onOpenItemEdit}
              onAddDraft={onAddDraft}
              onRemoveDraft={onRemoveDraft}
              onDelete={onDelete}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface ItemsTableProps {
  parentId: string;
  versionId: string;
  items: BomTreeNode[];
  drafts: DraftEntry[];
  depth: number;
  matById: Map<string, MaterialLite>;
  materials: MaterialLite[];
  categoriaOrder: string[];
  readOnly: boolean;
  showCumulative: boolean;
  editingItems: Set<string>;
  onToggleItemEdit: (nodeId: string) => void;
  onOpenItemEdit: (nodeId: string) => void;
  onAddDraft: (parentId: string, categoria: string) => void;
  onRemoveDraft: (parentId: string, draftId: string) => void;
  onDelete: (n: BomTreeNode) => void;
}

function parseBitolaValue(b: string): number {
  const trimmed = b.trim();
  const spaceParts = trimmed.split(' ');
  if (spaceParts.length === 2) {
    const whole = parseFloat(spaceParts[0]) || 0;
    const fracParts = spaceParts[1].split('/');
    const frac = fracParts.length === 2 ? (parseFloat(fracParts[0]) || 0) / (parseFloat(fracParts[1]) || 1) : 0;
    return whole + frac;
  }
  if (trimmed.includes('/')) {
    const fracParts = trimmed.split('/');
    return (parseFloat(fracParts[0]) || 0) / (parseFloat(fracParts[1]) || 1);
  }
  return parseFloat(trimmed) || 0;
}

function ItemsByCategoryTable({
  parentId, versionId, items, drafts, depth, matById, materials, categoriaOrder,
  readOnly, showCumulative, editingItems, onToggleItemEdit, onOpenItemEdit, onAddDraft, onRemoveDraft, onDelete,
}: ItemsTableProps) {
  const duplicate = useDuplicateBomSubtree();

  const grouped = useMemo(() => {
    const groups = new Map<string, BomTreeNode[]>();
    for (const it of items) {
      const mat = it.material_id ? matById.get(it.material_id) : null;
      const cat = (mat?.categoria || '').trim() || SEM_CATEGORIA_LABEL;
      const list = groups.get(cat) ?? [];
      list.push(it);
      groups.set(cat, list);
    }
    const sortEntries = (list: BomTreeNode[]) =>
      [...list].sort((a, b) => {
        const ma = a.material_id ? matById.get(a.material_id) : null;
        const mb = b.material_id ? matById.get(b.material_id) : null;
        const descCmp = (ma?.descricao || '').localeCompare(mb?.descricao || '', undefined, {
          numeric: true,
          sensitivity: 'base',
        });
        if (descCmp !== 0) return descCmp;
        return parseBitolaValue(ma?.bitola || '') - parseBitolaValue(mb?.bitola || '');
      });
    const ordered: [string, BomTreeNode[]][] = [];
    const seen = new Set<string>();
    for (const c of categoriaOrder) {
      if (groups.has(c)) { ordered.push([c, sortEntries(groups.get(c)!)]); seen.add(c); }
    }
    for (const [c, list] of groups) {
      if (c !== SEM_CATEGORIA_LABEL && !seen.has(c)) ordered.push([c, sortEntries(list)]);
    }
    if (groups.has(SEM_CATEGORIA_LABEL)) ordered.push([SEM_CATEGORIA_LABEL, sortEntries(groups.get(SEM_CATEGORIA_LABEL)!)]);
    return ordered;
  }, [items, matById, categoriaOrder]);

  const allCategoryCards = useMemo(() => {
    const map = new Map<string, BomTreeNode[]>(grouped);
    for (const d of drafts) {
      if (!map.has(d.categoria)) map.set(d.categoria, []);
    }
    const ordered: [string, BomTreeNode[]][] = [];
    const seen = new Set<string>();
    for (const c of categoriaOrder) {
      if (map.has(c)) { ordered.push([c, map.get(c)!]); seen.add(c); }
    }
    for (const [c, list] of map) {
      if (c !== SEM_CATEGORIA_LABEL && !seen.has(c)) { ordered.push([c, list]); seen.add(c); }
    }
    if (map.has(SEM_CATEGORIA_LABEL)) ordered.push([SEM_CATEGORIA_LABEL, map.get(SEM_CATEGORIA_LABEL)!]);
    return ordered;
  }, [grouped, drafts, categoriaOrder]);

  const startIndexByCategory = useMemo(() => {
    const map = new Map<string, number>();
    let running = 0;
    for (const [cat, entries] of grouped) {
      map.set(cat, running);
      running += entries.length;
    }
    return map;
  }, [grouped]);

  const colCount = readOnly ? 8 : 9;

  return (
    <div style={{ paddingLeft: `${depth * 18 + 4}px` }} className="space-y-3 py-2">
      {allCategoryCards.map(([categoria, entries]) => {
        const startIndex = startIndexByCategory.get(categoria) ?? 0;
        const categoryDrafts = drafts.filter((d) => d.categoria === categoria);
        const materialsInCategory = materials.filter((m) => {
          const cat = ((m as MaterialLite).categoria || '').trim() || SEM_CATEGORIA_LABEL;
          return cat === categoria;
        });
        return (
        <div key={categoria} className="rounded-md border bg-card/40">
          <div className="px-3 py-2 border-b flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-sm truncate">{categoria}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                ({entries.length} {entries.length === 1 ? 'item' : 'itens'})
              </span>
            </div>
            {!readOnly && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => onAddDraft(parentId, categoria)}
                aria-label={`Adicionar item em ${categoria}`}
                title={`Adicionar item em ${categoria}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b text-left text-xs font-normal text-muted-foreground">
                  <th className="py-2 px-2 font-normal w-10">#</th>
                  <th className="py-2 px-2 font-normal">TAG</th>
                  <th className="py-2 px-2 font-normal">Descrição</th>
                  <th className="py-2 px-2 font-normal">Bitola</th>
                  <th className="py-2 px-2 font-normal">ERP</th>
                  <th className="py-2 px-2 font-normal text-right">Qtd</th>
                  <th className="py-2 px-2 font-normal">Un.</th>
                  <th className="py-2 px-2 font-normal">Notas</th>
                  {!readOnly && <th className="py-2 px-2 font-normal w-1"></th>}
                </tr>
              </thead>
              <tbody>
                {entries.map((it, idx) => {
                  const isEditing = editingItems.has(it.id);
                  const mat = it.material_id ? matById.get(it.material_id) : null;
                  const descricao = mat?.descricao || '(item desconhecido)';
                  const bitola = mat?.bitola || '—';
                  const erp = mat?.erp || '—';
                  const unidade = mat?.unidade || '—';
                  const notas = (it.notes && it.notes.trim()) || mat?.notas || '—';
                  const tag = (it.name && it.name.trim()) || '-';
                  const qty = (showCumulative ? it.cumulativeQuantity : it.quantity) ?? 0;

                  const duplicateAction = !readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Duplicar item"
                      onClick={async () => {
                        try {
                          const newId = await duplicate.mutateAsync({ versionId: it.version_id, nodeId: it.id });
                          toast.success('Item duplicado');
                          if (newId) onOpenItemEdit(newId);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Erro ao duplicar');
                        }
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  );
                  const removeAction = !readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Remover item"
                      onClick={() => onDelete(it)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  );

                  if (!isEditing) {
                    return (
                      <tr key={it.id} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-2 align-middle">{startIndex + idx + 1}</td>
                        <td className="py-2 px-2 align-middle">{tag}</td>
                        <td className="py-2 px-2 align-middle max-w-[20rem]">
                          <span className="block truncate" title={descricao}>{descricao}</span>
                        </td>
                        <td className="py-2 px-2 align-middle">{bitola}</td>
                        <td className="py-2 px-2 align-middle">{erp}</td>
                        <td className="py-2 px-2 align-middle text-right tabular-nums">{qty}</td>
                        <td className="py-2 px-2 align-middle">{unidade}</td>
                        <td className="py-2 px-2 align-middle max-w-[14rem]">
                          <span className="block truncate" title={notas}>{notas}</span>
                        </td>
                        {!readOnly && (
                          <td className="py-1 px-2 align-middle">
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Editar item"
                                onClick={() => onToggleItemEdit(it.id)}
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              {duplicateAction}
                              {removeAction}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  }

                  return (
                    <tr key={it.id} className="border-b">
                      <td colSpan={colCount} className="p-0">
                        <ItemEditRow
                          item={it}
                          index={startIndex + idx}
                          materials={materials}
                          extraActions={
                            <>
                              {duplicateAction}
                              {removeAction}
                            </>
                          }
                          onDone={() => onToggleItemEdit(it.id)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {categoryDrafts.length > 0 && (
              <table className="w-full text-sm border-collapse border-t">
                <tbody>
                  {categoryDrafts.map((draft, di) => (
                    <tr key={draft.id} className="border-b">
                      <td className="p-0">
                        <NewItemDraftRow
                          index={entries.length + di}
                          parentId={parentId}
                          versionId={versionId}
                          materials={materialsInCategory}
                          onDone={() => onRemoveDraft(parentId, draft.id)}
                          onDiscard={() => onRemoveDraft(parentId, draft.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}

interface ItemEditRowProps {
  item: BomTreeNode;
  index: number;
  materials: MaterialLite[];
  extraActions: React.ReactNode;
  onDone: () => void;
}

function ItemEditRow({ item, index, materials, extraActions, onDone }: ItemEditRowProps) {
  const update = useUpdateBomNode();

  const [tag, setTag] = useState<string>(item.name ?? '');
  const [descricao, setDescricao] = useState<string>(() => {
    const mat = item.material_id ? materials.find((m) => m.id === item.material_id) : null;
    return mat?.descricao ?? '';
  });
  const [bitola, setBitola] = useState<string>(() => {
    const mat = item.material_id ? materials.find((m) => m.id === item.material_id) : null;
    return mat?.bitola ?? '';
  });
  const [materialId, setMaterialId] = useState<string | null>(item.material_id);
  const [quantity, setQuantity] = useState<string>(item.quantity != null ? String(item.quantity) : '1');
  const [notes, setNotes] = useState<string>(() => {
    if (item.notes && item.notes.trim()) return item.notes;
    const mat = item.material_id ? materials.find((m) => m.id === item.material_id) : null;
    return mat?.notas ?? '';
  });

  const descriptions = useMemo(
    () => [...new Set(materials.map((m) => m.descricao))].sort(),
    [materials],
  );
  const bitolas = useMemo(() => {
    if (!descricao) return [] as string[];
    const set = new Set(materials.filter((m) => m.descricao === descricao).map((m) => m.bitola));
    return [...set].sort((a, b) => parseBitolaValue(a) - parseBitolaValue(b));
  }, [materials, descricao]);

  const currentMaterial = useMemo(
    () => materials.find((m) => m.id === materialId) ?? null,
    [materials, materialId],
  );

  const handleDescChange = (v: string) => {
    setDescricao(v);
    setBitola('');
    setMaterialId(null);
  };
  const handleBitolaChange = (v: string) => {
    setBitola(v);
    const mat = materials.find((m) => m.descricao === descricao && m.bitola === v);
    setMaterialId(mat?.id ?? null);
    setNotes(mat?.notas ?? '');
  };

  const persist = async () => {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Quantidade deve ser > 0');
      return false;
    }
    if (!materialId) {
      toast.error('Selecione descrição e bitola');
      return false;
    }
    const trimmedTag = tag.trim();
    const trimmedNotes = notes.trim();
    try {
      await update.mutateAsync({
        versionId: item.version_id,
        nodeId: item.id,
        name: trimmedTag || null,
        clearName: trimmedTag === '',
        quantity: qty,
        notes: trimmedNotes || null,
        clearNotes: trimmedNotes === '',
        materialId: materialId !== item.material_id ? materialId : null,
      });
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar');
      return false;
    }
  };

  const saveAndClose = async () => {
    if (await persist()) onDone();
  };

  return (
    <div
      className="bg-card/40 p-3 sm:p-4"
      data-item-id={item.id}
      onKeyDown={async (e) => {
        if (e.key !== 'Enter' || e.defaultPrevented) return;
        const target = e.target as HTMLElement;
        if (target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        (target as HTMLElement).blur?.();
        await saveAndClose();
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">Item {index + 1}</span>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Concluir edição"
            onClick={saveAndClose}
            disabled={update.isPending}
          >
            <Check className="h-4 w-4 text-primary" />
          </Button>
          {extraActions}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 lg:grid-cols-12 gap-3">
        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
          <Label className="text-xs font-medium text-foreground/80">TAG</Label>
          <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="-" />
        </div>

        <div className="col-span-2 sm:col-span-6 lg:col-span-5">
          <Label className="text-xs font-medium text-foreground/80">Descrição *</Label>
          <SearchableSelect
            options={descriptions}
            value={descricao}
            onValueChange={handleDescChange}
            placeholder="Selecione"
            searchPlaceholder="Buscar material..."
            emptyMessage="Nenhum material encontrado."
            triggerProps={{ 'data-autofocus': 'true' }}
          />
        </div>

        <div className="col-span-2 sm:col-span-3 lg:col-span-3">
          <Label className="text-xs font-medium text-foreground/80">Bitola *</Label>
          <SearchableSelect
            options={bitolas}
            value={bitola}
            onValueChange={handleBitolaChange}
            disabled={!descricao}
            placeholder="Bitola"
            searchPlaceholder="Buscar bitola..."
            emptyMessage="Nenhuma bitola encontrada."
          />
        </div>

        <div className="col-span-1 sm:col-span-3 lg:col-span-2">
          <Label className="text-xs font-medium text-foreground/80">ERP</Label>
          <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/40 text-sm">
            {currentMaterial?.erp || '-'}
          </div>
        </div>

        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
          <Label className="text-xs font-medium text-foreground/80">Qtd *</Label>
          <Input
            type="number"
            min={0}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
          <Label className="text-xs font-medium text-foreground/80">Unid.</Label>
          <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/40 text-sm">
            {currentMaterial?.unidade || '-'}
          </div>
        </div>

        <div className="col-span-2 sm:col-span-6 lg:col-span-8">
          <Label className="text-xs font-medium text-foreground/80">Notas</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações"
          />
        </div>
      </div>
    </div>
  );
}

interface NewItemDraftRowProps {
  index: number;
  parentId: string;
  versionId: string;
  materials: MaterialLite[];
  onDone: () => void;
  onDiscard: () => void;
}

function NewItemDraftRow({
  index, parentId, versionId, materials, onDone, onDiscard,
}: NewItemDraftRowProps) {
  const add = useAddBomNode();

  const [tag, setTag] = useState('');
  const [descricao, setDescricao] = useState('');
  const [bitola, setBitola] = useState('');
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');

  const descriptions = useMemo(
    () => [...new Set(materials.map((m) => m.descricao))].sort(),
    [materials],
  );
  const bitolas = useMemo(() => {
    if (!descricao) return [] as string[];
    const set = new Set(materials.filter((m) => m.descricao === descricao).map((m) => m.bitola));
    return [...set].sort((a, b) => parseBitolaValue(a) - parseBitolaValue(b));
  }, [materials, descricao]);

  const currentMaterial = useMemo(
    () => materials.find((m) => m.id === materialId) ?? null,
    [materials, materialId],
  );

  const handleDescChange = (v: string) => {
    setDescricao(v);
    setBitola('');
    setMaterialId(null);
  };
  const handleBitolaChange = (v: string) => {
    setBitola(v);
    const mat = materials.find((m) => m.descricao === descricao && m.bitola === v);
    setMaterialId(mat?.id ?? null);
    setNotes(mat?.notas ?? '');
  };

  const persist = async () => {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Quantidade deve ser > 0');
      return false;
    }
    if (!materialId) {
      toast.error('Selecione descrição e bitola');
      return false;
    }
    const trimmedTag = tag.trim();
    const trimmedNotes = notes.trim();
    try {
      await add.mutateAsync({
        versionId,
        parentId,
        nodeType: 'ITEM',
        name: trimmedTag || null,
        materialId,
        quantity: qty,
        notes: trimmedNotes || null,
      });
      toast.success('Item adicionado');
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao adicionar');
      return false;
    }
  };

  const saveAndClose = async () => {
    if (await persist()) onDone();
  };

  return (
    <div
      className="bg-card/40 p-3 sm:p-4"
      onKeyDown={async (e) => {
        if (e.key !== 'Enter' || e.defaultPrevented) return;
        const target = e.target as HTMLElement;
        if (target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        (target as HTMLElement).blur?.();
        await saveAndClose();
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">Item {index + 1}</span>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Adicionar item"
            onClick={saveAndClose}
            disabled={add.isPending}
          >
            <Check className="h-4 w-4 text-primary" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Descartar"
            onClick={onDiscard}
            disabled={add.isPending}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 lg:grid-cols-12 gap-3">
        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
          <Label className="text-xs font-medium text-foreground/80">TAG</Label>
          <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="-" />
        </div>

        <div className="col-span-2 sm:col-span-6 lg:col-span-5">
          <Label className="text-xs font-medium text-foreground/80">Descrição *</Label>
          <SearchableSelect
            options={descriptions}
            value={descricao}
            onValueChange={handleDescChange}
            placeholder="Selecione"
            searchPlaceholder="Buscar material..."
            emptyMessage="Nenhum material encontrado."
          />
        </div>

        <div className="col-span-2 sm:col-span-3 lg:col-span-3">
          <Label className="text-xs font-medium text-foreground/80">Bitola *</Label>
          <SearchableSelect
            options={bitolas}
            value={bitola}
            onValueChange={handleBitolaChange}
            disabled={!descricao}
            placeholder="Bitola"
            searchPlaceholder="Buscar bitola..."
            emptyMessage="Nenhuma bitola encontrada."
          />
        </div>

        <div className="col-span-1 sm:col-span-3 lg:col-span-2">
          <Label className="text-xs font-medium text-foreground/80">ERP</Label>
          <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/40 text-sm">
            {currentMaterial?.erp || '-'}
          </div>
        </div>

        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
          <Label className="text-xs font-medium text-foreground/80">Qtd *</Label>
          <Input
            type="number"
            min={0}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
          <Label className="text-xs font-medium text-foreground/80">Unid.</Label>
          <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/40 text-sm">
            {currentMaterial?.unidade || '-'}
          </div>
        </div>

        <div className="col-span-2 sm:col-span-6 lg:col-span-8">
          <Label className="text-xs font-medium text-foreground/80">Notas</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações"
          />
        </div>
      </div>
    </div>
  );
}

function DeleteConfirm({
  node, versionId, onClose,
}: { node: BomTreeNode | null; versionId: string; onClose: () => void }) {
  const remove = useRemoveBomSubtree();
  if (!node) return null;
  const hasChildren = node.children.length > 0;
  return (
    <AlertDialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover nó?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasChildren
              ? `Este nó possui ${node.children.length} filho(s). Toda a subárvore será removida.`
              : 'Esta ação remove o nó selecionado.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              try {
                await remove.mutateAsync({ versionId, nodeId: node.id });
                toast.success('Nó removido');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Erro ao remover');
              } finally {
                onClose();
              }
            }}
          >
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

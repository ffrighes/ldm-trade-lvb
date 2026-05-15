import { useEffect, useState } from 'react';
import { FolderTree, Tags } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { BomRoot, BomVersion } from '@/types/bom';
import type { ExportChildData } from '@/lib/exportConjuntoPdf';

export interface ExportXlsxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  root: BomRoot;
  version: BomVersion;
  descendants: ExportChildData[];
  availableCategories: string[];
  onConfirm: (selection: {
    selectedRootIds: Set<string>;
    selectedCategories: Set<string>;
  }) => void;
}

interface TreeRow {
  rootId: string;
  label: string;
  versionInfo: string;
  depth: number;
  /** All descendant IDs including self */
  descendantIds: string[];
}

function flattenTree(
  root: BomRoot,
  version: BomVersion,
  descendants: ExportChildData[],
): TreeRow[] {
  const rows: TreeRow[] = [];

  function collectDescendantIds(children: ExportChildData[]): string[] {
    const ids: string[] = [];
    for (const c of children) {
      ids.push(c.root.id);
      ids.push(...collectDescendantIds(c.children));
    }
    return ids;
  }

  function walkChildren(children: ExportChildData[], depth: number): void {
    for (const c of children) {
      const versionInfo = `v${c.version.version_number}, ${c.version.status}`;
      const selfAndDescendants = [c.root.id, ...collectDescendantIds(c.children)];
      rows.push({
        rootId: c.root.id,
        label: `${c.root.codigo} — ${c.root.name}`,
        versionInfo,
        depth,
        descendantIds: selfAndDescendants,
      });
      walkChildren(c.children, depth + 1);
    }
  }

  const rootDescendantIds = [root.id, ...collectDescendantIds(descendants)];
  const rootVersionInfo = version.label
    ? `v${version.version_number} — ${version.label}, ${version.status}`
    : `v${version.version_number}, ${version.status}`;

  rows.push({
    rootId: root.id,
    label: `${root.codigo} — ${root.name}`,
    versionInfo: rootVersionInfo,
    depth: 0,
    descendantIds: rootDescendantIds,
  });

  walkChildren(descendants, 1);
  return rows;
}

function getCheckState(
  row: TreeRow,
  selected: Set<string>,
): boolean | 'indeterminate' {
  const selfChecked = selected.has(row.rootId);
  if (row.descendantIds.length === 1) return selfChecked;
  const descendantsChecked = row.descendantIds.filter((id) => selected.has(id)).length;
  const total = row.descendantIds.length;
  if (descendantsChecked === total) return true;
  if (descendantsChecked === 0) return false;
  return 'indeterminate';
}

export function ExportXlsxDialog({
  open,
  onOpenChange,
  root,
  version,
  descendants,
  availableCategories,
  onConfirm,
}: ExportXlsxDialogProps) {
  const [selectedRootIds, setSelectedRootIds] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  const treeRows = flattenTree(root, version, descendants);

  const allRootIds = treeRows.map((r) => r.rootId);

  useEffect(() => {
    if (open) {
      setSelectedRootIds(new Set(allRootIds));
      setSelectedCategories(new Set(availableCategories));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, root.id, descendants.length, availableCategories.length]);

  function handleToggleRoot(row: TreeRow) {
    const isSelfChecked = selectedRootIds.has(row.rootId);
    setSelectedRootIds((prev) => {
      const next = new Set(prev);
      if (isSelfChecked) {
        for (const id of row.descendantIds) next.delete(id);
      } else {
        for (const id of row.descendantIds) next.add(id);
      }
      return next;
    });
  }

  function handleToggleCategory(cat: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function handleSelectAllRoots() {
    setSelectedRootIds(new Set(allRootIds));
  }

  function handleClearRoots() {
    setSelectedRootIds(new Set());
  }

  function handleSelectAllCategories() {
    setSelectedCategories(new Set(availableCategories));
  }

  function handleClearCategories() {
    setSelectedCategories(new Set());
  }

  function handleConfirm() {
    onConfirm({ selectedRootIds, selectedCategories });
    onOpenChange(false);
  }

  const canExport = selectedRootIds.size > 0 && selectedCategories.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exportar Lista de Materiais (XLSX)</DialogTitle>
          <DialogDescription>
            Selecione os conjuntos e categorias que devem constar na exportação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Conjuntos section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-medium text-sm">
                <FolderTree className="h-4 w-4" />
                Conjuntos
              </div>
              <div className="flex items-center gap-1">
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={handleSelectAllRoots}>
                  Selecionar todos
                </Button>
                <span className="text-muted-foreground text-xs">·</span>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={handleClearRoots}>
                  Limpar seleção
                </Button>
              </div>
            </div>
            <ScrollArea className="h-48 border rounded-md p-2">
              <div className="space-y-1">
                {treeRows.map((row) => {
                  const checkState = getCheckState(row, selectedRootIds);
                  const checkboxId = `root-${row.rootId}`;
                  return (
                    <div
                      key={row.rootId}
                      className="flex items-center gap-2"
                      style={{ paddingLeft: `${row.depth * 20}px` }}
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={checkState}
                        onCheckedChange={() => handleToggleRoot(row)}
                      />
                      <Label htmlFor={checkboxId} className="cursor-pointer font-normal text-sm leading-tight">
                        <span>{row.label}</span>
                        <span className="text-muted-foreground ml-2 text-xs">({row.versionInfo})</span>
                      </Label>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Categorias section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Tags className="h-4 w-4" />
                Categorias
              </div>
              <div className="flex items-center gap-1">
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={handleSelectAllCategories}>
                  Selecionar todos
                </Button>
                <span className="text-muted-foreground text-xs">·</span>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={handleClearCategories}>
                  Limpar seleção
                </Button>
              </div>
            </div>
            {availableCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground px-2">(Nenhuma categoria encontrada)</p>
            ) : (
              <ScrollArea className="h-36 border rounded-md p-2">
                <div className="space-y-1">
                  {availableCategories.map((cat) => {
                    const checkboxId = `cat-${cat}`;
                    return (
                      <div key={cat} className="flex items-center gap-2">
                        <Checkbox
                          id={checkboxId}
                          checked={selectedCategories.has(cat)}
                          onCheckedChange={() => handleToggleCategory(cat)}
                        />
                        <Label htmlFor={checkboxId} className="cursor-pointer font-normal text-sm">
                          {cat}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          {selectedRootIds.size} conjuntos · {selectedCategories.size} categorias selecionados
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleConfirm} disabled={!canExport}>
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

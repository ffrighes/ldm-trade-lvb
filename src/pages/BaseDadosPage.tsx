import { Fragment, useState, useMemo, useRef } from "react";
import { useMaterials, useAddMaterial, useUpdateMaterial, useDeleteMaterial } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Upload, Download, PlusCircle, FolderPen, Tags } from "lucide-react";
import { SearchInput } from "@/components/SearchInput";
import { useSearch } from "@/hooks/useSearch";
import { highlightMatch } from "@/lib/highlight";
import { SEARCH_MIN_LENGTH } from "@/lib/sanitizeSearch";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from "sonner";
import { formatBRL, parseBRL } from "@/lib/formatCurrency";
import { SEM_CATEGORIA_LABEL } from "@/lib/categorias";
import { useCategorias, useAddCategoria, useDeleteCategoria, useRenameCategoria } from "@/hooks/useCategorias";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

function parseBitolaValue(bitola: string): number {
  const s = bitola.trim().replace(/"/g, "").replace(/^DN\s*/i, "");
  // "1 1/2" → 1.5, "3/4" → 0.75
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
  const fraction = s.match(/^(\d+)\/(\d+)$/);
  if (fraction) return parseInt(fraction[1]) / parseInt(fraction[2]);
  const num = parseFloat(s.replace(",", "."));
  return isNaN(num) ? Infinity : num;
}

export default function BaseDadosPage() {
  const { data: materials = [] } = useMaterials();
  const addMaterial = useAddMaterial();
  const updateMaterial = useUpdateMaterial();
  const deleteMaterial = useDeleteMaterial();
  const { canModifyBaseDados } = usePermissions();
  const { data: categorias = [] } = useCategorias();
  const addCategoria = useAddCategoria();
  const renameCategoria = useRenameCategoria();
  const deleteCategoria = useDeleteCategoria();

  const search = useSearch({
    debounceMs: 300,
    storageKey: "materiais:recent-searches",
  });
  const [descFilter, setDescFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ descricao: "", bitola: "", unidade: "m", erp: "", custo: "", notas: "", categoria: "" });
  const [categoriaFilter, setCategoriaFilter] = useState("all");
  const [newFamilyCategoria, setNewFamilyCategoria] = useState<string>("");
  const [editingFamilyCategoria, setEditingFamilyCategoria] = useState<string>("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [clearBeforeImport, setClearBeforeImport] = useState(false);
  const [renameFamilyOpen, setRenameFamilyOpen] = useState(false);
  const [renamingFamily, setRenamingFamily] = useState("");
  const [newFamilyName, setNewFamilyName] = useState("");
  const [renamingFamily_saving, setRenamingFamily_saving] = useState(false);
  const [newFamilyDialogOpen, setNewFamilyDialogOpen] = useState(false);
  const [newFamilyInput, setNewFamilyInput] = useState("");
  const [deleteFamilyTarget, setDeleteFamilyTarget] = useState<string | null>(null);
  const [manageCategoriasOpen, setManageCategoriasOpen] = useState(false);
  const [newCategoriaInput, setNewCategoriaInput] = useState("");
  const [editingCategoria, setEditingCategoria] = useState<string | null>(null);
  const [editingCategoriaName, setEditingCategoriaName] = useState("");
  const [deleteCategoriaTarget, setDeleteCategoriaTarget] = useState<string | null>(null);
  const [selectedFamilies, setSelectedFamilies] = useState<Set<string>>(new Set());
  const [batchCategoria, setBatchCategoria] = useState<string>("");
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleImportXlsx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    const MAX_ROWS = 5000;

    if (!canModifyBaseDados) {
      toast.error("Você não tem permissão para importar materiais.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande (máx. 5 MB).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (clearBeforeImport) {
      const confirmed = window.confirm(
        "ATENÇÃO: Esta ação removerá PERMANENTEMENTE todos os materiais e itens de BOM existentes antes da importação. Deseja continuar?"
      );
      if (!confirmed) {
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }

    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rows.length > MAX_ROWS) {
        toast.error(`Planilha muito grande (máx. ${MAX_ROWS} linhas).`);
        return;
      }

      const headerMap: Record<string, string> = {
        "Descrição (Família)": "descricao",
        Descrição: "descricao",
        descricao: "descricao",
        Ø: "bitola",
        Bitola: "bitola",
        bitola: "bitola",
        "Un.": "unidade",
        Unidade: "unidade",
        unidade: "unidade",
        ERP: "erp",
        erp: "erp",
        Custo: "custo",
        custo: "custo",
        Notas: "notas",
        notas: "notas",
        Categoria: "categoria",
        categoria: "categoria",
      };

      const materials = rows
        .map((row) => {
          const mapped: any = {};
          for (const [key, value] of Object.entries(row)) {
            const field = headerMap[key.trim()];
            if (field) mapped[field] = value;
          }
          if (!mapped.descricao || !mapped.bitola) return null;
          const unRaw = String(mapped.unidade || "un").trim();
          const catRaw = String(mapped.categoria || "").trim();
          const categoria = catRaw || null;
          return {
            descricao: String(mapped.descricao).trim(),
            bitola: String(mapped.bitola).trim(),
            unidade: unRaw === "M" ? "m" : unRaw === "STK" ? "un" : unRaw.toLowerCase() || "un",
            erp: String(mapped.erp || "").trim(),
            custo: parseFloat(String(mapped.custo || "0").replace(",", ".")) || 0,
            notas: String(mapped.notas || "").trim(),
            categoria,
          };
        })
        .filter(Boolean) as any[];

      // Deduplicate by descricao+bitola, keeping last occurrence
      const deduped = new Map<string, any>();
      for (const m of materials) {
        deduped.set(`${m.descricao}|||${m.bitola}`, m);
      }
      const uniqueMaterials = [...deduped.values()];

      if (uniqueMaterials.length === 0) {
        toast.error("Nenhum item válido encontrado na planilha");
        return;
      }

      const newCategorias = [
        ...new Set(
          uniqueMaterials
            .map((m) => m.categoria)
            .filter((c): c is string => !!c && !categorias.includes(c)),
        ),
      ];
      if (newCategorias.length > 0) {
        const { error: catError } = await supabase
          .from("material_categorias" as never)
          .upsert(newCategorias.map((nome) => ({ nome })) as never, { onConflict: "nome" });
        if (catError) throw catError;
        queryClient.invalidateQueries({ queryKey: ["material_categorias"] });
      }

      if (clearBeforeImport) {
        const { error: itemsError } = await supabase
          .from("solicitacao_itens")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (itemsError) throw itemsError;
        const { error: delError } = await supabase
          .from("materials")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (delError) throw delError;
      }

      const batchSize = 100;
      let inserted = 0;
      for (let i = 0; i < uniqueMaterials.length; i += batchSize) {
        const batch = uniqueMaterials.slice(i, i + batchSize);
        const { error } = await supabase.from("materials").upsert(batch as any[], { onConflict: "descricao,bitola" });
        if (error) throw error;
        inserted += batch.length;
      }

      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success(`${inserted} itens importados com sucesso`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao importar: " + (err.message || "erro desconhecido"));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const descriptions = useMemo(() => [...new Set(materials.map((m) => m.descricao))].sort(), [materials]);

  const familyCategoria = useMemo(() => {
    const map = new Map<string, string | null>();
    materials.forEach((m) => {
      const cat = (m as any).categoria ?? null;
      if (!map.has(m.descricao)) map.set(m.descricao, cat);
    });
    return map;
  }, [materials]);

  const filtered = useMemo(
    () =>
      materials.filter((m) => {
        if (descFilter !== "all" && m.descricao !== descFilter) return false;
        if (categoriaFilter !== "all") {
          const cat = (m as any).categoria ?? null;
          if (categoriaFilter === "__none__") {
            if (cat) return false;
          } else if (cat !== categoriaFilter) {
            return false;
          }
        }
        if (search.debounced) {
          const s = search.debounced.toLowerCase();
          return (
            m.descricao.toLowerCase().includes(s) ||
            m.bitola.toLowerCase().includes(s) ||
            (m as any).erp?.toLowerCase().includes(s)
          );
        }
        return true;
      }),
    [materials, search.debounced, descFilter, categoriaFilter],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof materials>();
    filtered.forEach((m) => {
      const list = map.get(m.descricao) || [];
      list.push(m);
      map.set(m.descricao, list);
    });
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([desc, items]) => [
        desc,
        [...items].sort((a, b) => parseBitolaValue(a.bitola) - parseBitolaValue(b.bitola)),
      ] as [string, typeof materials]);
  }, [filtered]);

  const groupedByCategoria = useMemo(() => {
    const map = new Map<string, Array<[string, typeof materials]>>();
    grouped.forEach(([descricao, items]) => {
      const cat = familyCategoria.get(descricao) || null;
      const key = cat ?? "__none__";
      const list = map.get(key) || [];
      list.push([descricao, items]);
      map.set(key, list);
    });
    return [...map.entries()].sort(([a], [b]) => {
      if (a === "__none__") return 1;
      if (b === "__none__") return -1;
      return a.localeCompare(b);
    });
  }, [grouped, familyCategoria]);

  const toggleGroup = (desc: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(desc)) next.delete(desc);
      else next.add(desc);
      return next;
    });
  };

  const expandAll = () => setExpandedGroups(new Set(grouped.map(([d]) => d)));
  const collapseAll = () => setExpandedGroups(new Set());

  const handleSave = async () => {
    const custo = parseBRL(form.custo);
    if (!form.descricao.trim() || !form.bitola.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const categoria = form.categoria || familyCategoria.get(form.descricao) || null;
    try {
      if (editingId) {
        await updateMaterial.mutateAsync({
          id: editingId,
          descricao: form.descricao,
          bitola: form.bitola,
          unidade: form.unidade,
          erp: form.erp,
          custo,
          notas: form.notas,
          categoria,
        });
        toast.success("Item atualizado");
      } else {
        await addMaterial.mutateAsync({
          descricao: form.descricao,
          bitola: form.bitola,
          unidade: form.unidade,
          erp: form.erp,
          custo,
          notas: form.notas,
          categoria,
        });
        toast.success("Item adicionado");
      }
      setOpen(false);
    } catch (e: any) {
      if (e.message?.includes("duplicate") || e.code === "23505") {
        toast.error("Este item já existe na base");
      } else {
        toast.error("Erro ao salvar item");
      }
    }
  };

  const openEdit = (m: (typeof materials)[0]) => {
    setEditingId(m.id);
    setForm({
      descricao: m.descricao,
      bitola: m.bitola,
      unidade: m.unidade,
      erp: (m as any).erp || "",
      custo: m.custo.toString(),
      notas: (m as any).notas || "",
      categoria: (m as any).categoria || "",
    });
    setOpen(true);
  };

  const openRenameFamily = (descricao: string) => {
    setRenamingFamily(descricao);
    setNewFamilyName(descricao);
    setEditingFamilyCategoria(familyCategoria.get(descricao) || "");
    setRenameFamilyOpen(true);
  };

  const handleRenameFamily = async () => {
    const trimmed = newFamilyName.trim();
    const currentCategoria = familyCategoria.get(renamingFamily) || "";
    const newCategoria = editingFamilyCategoria || "";
    const nameChanged = trimmed && trimmed !== renamingFamily;
    const categoriaChanged = newCategoria !== currentCategoria;
    if (!trimmed || (!nameChanged && !categoriaChanged)) {
      setRenameFamilyOpen(false);
      return;
    }
    setRenamingFamily_saving(true);
    try {
      // 1. Atualizar a tabela materials (nome e/ou categoria)
      const updatePayload: Record<string, unknown> = {};
      if (nameChanged) updatePayload.descricao = trimmed;
      if (categoriaChanged) updatePayload.categoria = newCategoria || null;
      const { error } = await supabase
        .from("materials")
        .update(updatePayload as any)
        .eq("descricao", renamingFamily);
      if (error) throw error;

      // 2. Buscar solicitações ativas (não Finalizada nem Cancelada) e propagar nome
      if (nameChanged) {
        const { data: activeSols, error: solError } = await supabase
          .from("solicitacoes")
          .select("id")
          .not("status", "in", '("Finalizada","Cancelada")');
        if (solError) throw solError;

        if (activeSols && activeSols.length > 0) {
          const activeIds = activeSols.map((s) => s.id);
          const { error: itensError } = await supabase
            .from("solicitacao_itens")
            .update({ descricao: trimmed })
            .eq("descricao", renamingFamily)
            .in("solicitacao_id", activeIds);
          if (itensError) throw itensError;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      toast.success("Família atualizada com sucesso");
      setRenameFamilyOpen(false);
    } catch (err: any) {
      toast.error("Erro ao atualizar família: " + (err.message || "erro desconhecido"));
    } finally {
      setRenamingFamily_saving(false);
    }
  };

  const handleDeleteFamily = async (descricao: string) => {
    try {
      // 1. Obter IDs dos materiais da família
      const { data: familyMaterials, error: fetchError } = await supabase
        .from("materials")
        .select("id")
        .eq("descricao", descricao);
      if (fetchError) throw fetchError;

      // 2. Nulificar referências em solicitacao_itens (respeitar FK)
      if (familyMaterials && familyMaterials.length > 0) {
        const ids = familyMaterials.map((m) => m.id);
        const { error: itensError } = await supabase
          .from("solicitacao_itens")
          .update({ material_id: null })
          .in("material_id", ids);
        if (itensError) throw itensError;
      }

      // 3. Deletar os materiais
      const { error } = await supabase.from("materials").delete().eq("descricao", descricao);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success(`Família "${descricao}" excluída`);
    } catch (err: any) {
      toast.error("Erro ao excluir família: " + (err.message || "erro desconhecido"));
    } finally {
      setDeleteFamilyTarget(null);
    }
  };

  const openNew = (familiaDescricao?: string, categoria?: string) => {
    setEditingId(null);
    const inheritedCategoria = familiaDescricao ? familyCategoria.get(familiaDescricao) || "" : "";
    setForm({
      descricao: familiaDescricao ?? "",
      bitola: "",
      unidade: "m",
      erp: "",
      custo: "",
      notas: "",
      categoria: categoria ?? inheritedCategoria,
    });
    setOpen(true);
  };

  const handleAddCategoria = async () => {
    const name = newCategoriaInput.trim();
    if (!name) return;
    if (categorias.includes(name)) {
      toast.error("Esta categoria já existe");
      return;
    }
    try {
      await addCategoria.mutateAsync(name);
      setNewCategoriaInput("");
      toast.success("Categoria adicionada");
    } catch (err: any) {
      toast.error("Erro ao adicionar categoria: " + (err.message || "erro desconhecido"));
    }
  };

  const handleSaveCategoriaRename = async () => {
    if (!editingCategoria) return;
    const newName = editingCategoriaName.trim();
    if (!newName || newName === editingCategoria) {
      setEditingCategoria(null);
      return;
    }
    try {
      await renameCategoria.mutateAsync({ from: editingCategoria, to: newName });
      setEditingCategoria(null);
      toast.success("Categoria renomeada");
    } catch (err: any) {
      toast.error("Erro ao renomear categoria: " + (err.message || "erro desconhecido"));
    }
  };

  const handleDeleteCategoria = async (nome: string) => {
    try {
      await deleteCategoria.mutateAsync(nome);
      toast.success(`Categoria "${nome}" removida`);
    } catch (err: any) {
      toast.error("Erro ao excluir categoria: " + (err.message || "erro desconhecido"));
    } finally {
      setDeleteCategoriaTarget(null);
    }
  };

  const toggleFamilySelection = (descricao: string) => {
    setSelectedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(descricao)) next.delete(descricao);
      else next.add(descricao);
      return next;
    });
  };

  const visibleFamilyNames = useMemo(() => grouped.map(([d]) => d), [grouped]);

  const allVisibleSelected =
    visibleFamilyNames.length > 0 && visibleFamilyNames.every((d) => selectedFamilies.has(d));
  const someVisibleSelected =
    visibleFamilyNames.some((d) => selectedFamilies.has(d)) && !allVisibleSelected;

  const toggleSelectAllVisible = () => {
    setSelectedFamilies((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        visibleFamilyNames.forEach((d) => next.delete(d));
        return next;
      }
      const next = new Set(prev);
      visibleFamilyNames.forEach((d) => next.add(d));
      return next;
    });
  };

  const clearSelection = () => setSelectedFamilies(new Set());

  const handleBatchUpdateCategoria = async () => {
    if (selectedFamilies.size === 0) return;
    const newCategoria = batchCategoria || null;
    setBatchSaving(true);
    try {
      const families = [...selectedFamilies];
      const { error } = await supabase
        .from("materials")
        .update({ categoria: newCategoria } as any)
        .in("descricao", families);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success(
        `Categoria atualizada em ${families.length} ${families.length === 1 ? "família" : "famílias"}`,
      );
      setSelectedFamilies(new Set());
      setBatchCategoria("");
      setBatchConfirmOpen(false);
    } catch (err: any) {
      toast.error("Erro ao atualizar categorias: " + (err.message || "erro desconhecido"));
    } finally {
      setBatchSaving(false);
    }
  };

  const handleConfirmNewFamily = () => {
    const name = newFamilyInput.trim();
    if (!name) return;
    setNewFamilyDialogOpen(false);
    setNewFamilyInput("");
    const cat = newFamilyCategoria;
    setNewFamilyCategoria("");
    openNew(name, cat);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Base de Dados</h1>
        <div className="flex gap-2">
          <input type="file" accept=".xlsx,.xls" ref={fileInputRef} onChange={handleImportXlsx} className="hidden" />
          <Button
            variant="outline"
            onClick={() => {
              const exportData = materials.map((m) => ({
                "Descrição (Família)": m.descricao,
                Categoria: (m as any).categoria || "",
                Ø: m.bitola,
                "Un.": m.unidade,
                ERP: m.erp,
                Custo: m.custo,
                Notas: m.notas,
              }));
              const ws = XLSX.utils.json_to_sheet(exportData);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Materiais");
              XLSX.writeFile(wb, "base-dados.xlsx");
              toast.success("Planilha exportada");
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar XLSX
          </Button>
          {canModifyBaseDados && (
            <>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="clearBeforeImport"
                  checked={clearBeforeImport}
                  onCheckedChange={(v) => setClearBeforeImport(!!v)}
                />
                <Label htmlFor="clearBeforeImport" className="text-sm cursor-pointer">
                  Limpar base antes de importar
                </Label>
              </div>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                <Upload className="h-4 w-4 mr-2" />
                {importing ? "Importando..." : "Importar XLSX"}
              </Button>
              <Button variant="outline" onClick={() => setManageCategoriasOpen(true)}>
                <Tags className="h-4 w-4 mr-2" />
                Categorias
              </Button>
              <Button onClick={() => { setNewFamilyInput(""); setNewFamilyCategoria(""); setNewFamilyDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Família
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={manageCategoriasOpen} onOpenChange={setManageCategoriasOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                value={newCategoriaInput}
                onChange={(e) => setNewCategoriaInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCategoria()}
                placeholder="Nova categoria"
                autoFocus
              />
              <Button onClick={handleAddCategoria} disabled={addCategoria.isPending || !newCategoriaInput.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
            <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
              {categorias.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-6">Nenhuma categoria cadastrada</div>
              ) : (
                categorias.map((c) => {
                  const isEditing = editingCategoria === c;
                  const inUse = materials.some((m) => (m as any).categoria === c);
                  return (
                    <div key={c} className="flex items-center gap-2 px-3 py-2">
                      {isEditing ? (
                        <Input
                          className="h-8"
                          value={editingCategoriaName}
                          onChange={(e) => setEditingCategoriaName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveCategoriaRename();
                            if (e.key === "Escape") setEditingCategoria(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <span className="flex-1 text-sm">{c}</span>
                      )}
                      {!isEditing && (
                        <Badge variant="outline" className="text-xs">
                          {materials.filter((m) => (m as any).categoria === c).length} itens
                        </Badge>
                      )}
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            onClick={handleSaveCategoriaRename}
                            disabled={renameCategoria.isPending}
                          >
                            Salvar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingCategoria(null)}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingCategoria(c);
                              setEditingCategoriaName(c);
                            }}
                            title="Renomear"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteCategoriaTarget(c)}
                            title={inUse ? "Excluir (itens passarão a ficar sem categoria)" : "Excluir"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCategoriaTarget} onOpenChange={(v) => { if (!v) setDeleteCategoriaTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria <strong>{deleteCategoriaTarget}</strong> será removida. Os{" "}
              <strong>{materials.filter((m) => (m as any).categoria === deleteCategoriaTarget).length}</strong>{" "}
              item(ns) atualmente associados ficarão sem categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCategoriaTarget && handleDeleteCategoria(deleteCategoriaTarget)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={newFamilyDialogOpen} onOpenChange={setNewFamilyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Família</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label>Nome da família *</Label>
              <Input
                className="mt-2"
                value={newFamilyInput}
                onChange={(e) => setNewFamilyInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConfirmNewFamily()}
                placeholder="Ex: Tubo Sem Costura ASTM A106 Gr B"
                autoFocus
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={newFamilyCategoria || "__none__"} onValueChange={(v) => setNewFamilyCategoria(v === "__none__" ? "" : v)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{SEM_CATEGORIA_LABEL}</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleConfirmNewFamily} disabled={!newFamilyInput.trim()}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameFamilyOpen} onOpenChange={setRenameFamilyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Família</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label>Nome atual</Label>
              <p className="text-sm text-muted-foreground mt-1 font-mono">{renamingFamily}</p>
            </div>
            <div>
              <Label>Novo nome *</Label>
              <Input
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRenameFamily()}
                autoFocus
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={editingFamilyCategoria || "__none__"} onValueChange={(v) => setEditingFamilyCategoria(v === "__none__" ? "" : v)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{SEM_CATEGORIA_LABEL}</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleRenameFamily} disabled={renamingFamily_saving || !newFamilyName.trim()}>
              {renamingFamily_saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFamilyTarget} onOpenChange={(v) => { if (!v) setDeleteFamilyTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir família?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os <strong>{materials.filter(m => m.descricao === deleteFamilyTarget).length}</strong> itens da família{" "}
              <strong>{deleteFamilyTarget}</strong> serão excluídos permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFamilyTarget && handleDeleteFamily(deleteFamilyTarget)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir família
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Item" : "Novo Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Descrição (Família) *</Label>
              <Input value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div>
              <Label>Ø (Bitola) *</Label>
              <Input value={form.bitola} onChange={(e) => setForm((f) => ({ ...f, bitola: e.target.value }))} />
            </div>
            {/* CORRIGIDO: grid-cols-5 para dar mais espaço ao campo ERP */}
            <div className="grid grid-cols-5 gap-4">
              <div className="col-span-1">
                <Label>Unidade</Label>
                <Select value={form.unidade} onValueChange={(v) => setForm((f) => ({ ...f, unidade: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m">m</SelectItem>
                    <SelectItem value="un">un</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>ERP</Label>
                <Input
                  value={form.erp}
                  onChange={(e) => setForm((f) => ({ ...f, erp: e.target.value }))}
                  placeholder="Código ERP"
                />
              </div>
              <div className="col-span-2">
                <Label>Custo (R$)</Label>
                <Input
                  value={form.custo}
                  onChange={(e) => setForm((f) => ({ ...f, custo: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria || "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v === "__none__" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{SEM_CATEGORIA_LABEL}</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                placeholder="Observações..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={addMaterial.isPending || updateMaterial.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canModifyBaseDados && selectedFamilies.size > 0 && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border bg-accent/40 px-4 py-3">
          <div className="text-sm font-medium">
            {selectedFamilies.size} {selectedFamilies.size === 1 ? "família selecionada" : "famílias selecionadas"}
          </div>
          <div className="flex flex-1 flex-col sm:flex-row gap-2 sm:items-center">
            <Label className="text-sm text-muted-foreground sm:ml-2">Alterar categoria para:</Label>
            <Select
              value={batchCategoria || "__none__"}
              onValueChange={(v) => setBatchCategoria(v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{SEM_CATEGORIA_LABEL}</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setBatchConfirmOpen(true)} disabled={batchSaving}>
              Aplicar
            </Button>
            <Button variant="ghost" onClick={clearSelection} disabled={batchSaving}>
              Limpar seleção
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={batchConfirmOpen} onOpenChange={setBatchConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atualizar categoria em lote?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria de <strong>{selectedFamilies.size}</strong>{" "}
              {selectedFamilies.size === 1 ? "família" : "famílias"} será alterada para{" "}
              <strong>{batchCategoria || SEM_CATEGORIA_LABEL}</strong>. Todos os itens (bitolas) dessas famílias
              serão atualizados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchUpdateCategoria} disabled={batchSaving}>
              {batchSaving ? "Aplicando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="mb-4">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput
              className="flex-1"
              value={search.input}
              onChange={search.setInput}
              placeholder="Buscar por descrição, bitola ou ERP..."
              ariaLabel="Buscar materiais"
              ariaControls="materiais-results-status"
              isLoading={search.isDebouncing}
              showBelowMinHint={search.isBelowMin}
              belowMinHint={`Digite ao menos ${SEARCH_MIN_LENGTH} caracteres para buscar.`}
            />
            <span
              id="materiais-results-status"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {search.debounced
                ? `${filtered.length} resultado(s) para "${search.debounced}"`
                : `${filtered.length} material(is)`}
            </span>
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
                <SelectItem value="__none__">{SEM_CATEGORIA_LABEL}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={descFilter} onValueChange={setDescFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Filtrar família" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as famílias</SelectItem>
                {descriptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 items-center">
              {canModifyBaseDados && grouped.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer pl-1 pr-2">
                  <Checkbox
                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAllVisible}
                    aria-label="Selecionar todas as famílias visíveis"
                  />
                  Selecionar todas
                </label>
              )}
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expandir tudo
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Recolher tudo
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {grouped.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              {search.debounced
                ? <>Nenhum material encontrado para <strong>"{search.debounced}"</strong>. Tente outro termo.</>
                : 'Nenhum item encontrado'}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedByCategoria.map(([categoriaKey, families]) => {
            const categoriaLabel = categoriaKey === "__none__" ? SEM_CATEGORIA_LABEL : categoriaKey;
            const totalBitolas = families.reduce((sum, [, items]) => sum + items.length, 0);
            return (
              <Card key={categoriaKey}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={categoriaKey === "__none__" ? "outline" : "secondary"}
                      className="text-sm"
                    >
                      {categoriaLabel}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {families.length} {families.length === 1 ? "família" : "famílias"} · {totalBitolas} {totalBitolas === 1 ? "bitola" : "bitolas"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Table>
                    <TableBody>
                      {families.map(([descricao, items]) => {
                        const isExpanded = expandedGroups.has(descricao);
                        const colSpan = 2 + (canModifyBaseDados ? 2 : 0);
                        return (
                          <Fragment key={descricao}>
                            <TableRow className="hover:bg-muted/40">
                              {canModifyBaseDados && (
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={selectedFamilies.has(descricao)}
                                    onCheckedChange={() => toggleFamilySelection(descricao)}
                                    aria-label={`Selecionar família ${descricao}`}
                                  />
                                </TableCell>
                              )}
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => toggleGroup(descricao)}
                                  aria-label={isExpanded ? "Recolher" : "Expandir"}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableCell>
                              <TableCell className="font-medium">{highlightMatch(descricao, search.debounced)}</TableCell>
                              {canModifyBaseDados && (
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-muted-foreground hover:text-foreground"
                                      onClick={(e) => { e.stopPropagation(); openRenameFamily(descricao); }}
                                      title="Renomear família"
                                    >
                                      <FolderPen className="h-3.5 w-3.5 mr-1" />
                                      <span className="text-xs">Renomear</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-muted-foreground hover:text-foreground"
                                      onClick={(e) => { e.stopPropagation(); openNew(descricao); }}
                                      title="Adicionar bitola a esta família"
                                    >
                                      <PlusCircle className="h-3.5 w-3.5 mr-1" />
                                      <span className="text-xs">Bitola</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-destructive hover:text-destructive"
                                      onClick={(e) => { e.stopPropagation(); setDeleteFamilyTarget(descricao); }}
                                      title="Excluir família"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                            {isExpanded && (
                              <TableRow className="bg-muted/20 hover:bg-muted/20">
                                <TableCell colSpan={colSpan} className="p-0">
                                  <div className="overflow-x-auto px-4 py-2">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Ø</TableHead>
                                          <TableHead>Un.</TableHead>
                                          <TableHead className="min-w-[160px]">ERP</TableHead>
                                          <TableHead className="text-right">Custo</TableHead>
                                          <TableHead>Notas</TableHead>
                                          {canModifyBaseDados && <TableHead className="w-24">Ações</TableHead>}
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {items.map((m) => (
                                          <TableRow key={m.id}>
                                            <TableCell className="font-mono">{highlightMatch(m.bitola, search.debounced)}</TableCell>
                                            <TableCell>{m.unidade}</TableCell>
                                            <TableCell className="font-mono">{(() => { const e = (m as any).erp; return e ? highlightMatch(e, search.debounced) : "-"; })()}</TableCell>
                                            <TableCell className="text-right font-mono">
                                              {m.custo > 0 ? formatBRL(m.custo) : "-"}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                                              {(m as any).notas || "-"}
                                            </TableCell>
                                            {canModifyBaseDados && (
                                              <TableCell>
                                                <div className="flex gap-1">
                                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                  </Button>
                                                  <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                      <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                                      >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                      </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                      <AlertDialogHeader>
                                                        <AlertDialogTitle>Excluir item?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                          Esta ação não pode ser desfeita. O item{" "}
                                                          <strong>
                                                            {m.descricao} {m.bitola}
                                                          </strong>{" "}
                                                          será removido permanentemente.
                                                        </AlertDialogDescription>
                                                      </AlertDialogHeader>
                                                      <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction
                                                          onClick={() => deleteMaterial.mutate(m.id)}
                                                          className="bg-destructive hover:bg-destructive/90"
                                                        >
                                                          Excluir
                                                        </AlertDialogAction>
                                                      </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                  </AlertDialog>
                                                </div>
                                              </TableCell>
                                            )}
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

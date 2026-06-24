import { Fragment, useState, useMemo, useRef, useEffect } from "react";
import { useMaterials, useAddMaterial, useUpdateMaterial, useDeleteMaterial } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ChevronUp, Upload, Download, PlusCircle, FolderPen, Tags, X, AlertTriangle, Info, Database } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";
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

/**
 * Normaliza um custo digitado em formato pt-BR (vírgula decimal, ponto de
 * milhar) para número. Reaproveita a convenção de `parseBRL` e adiciona
 * validação estrita: retorna `null` para entradas inválidas ou negativas.
 */
function parseCustoInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const cleaned = trimmed.replace(/[R$\s.]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const num = parseFloat(cleaned);
  if (!isFinite(num) || num < 0) return null;
  return num;
}

/**
 * Célula em edição inline (Custo ou ERP) na sub-tabela de bitolas.
 * - Salva ao pressionar Enter ou ao perder o foco (blur).
 * - Cancela com Esc (restaura o valor original, sem salvar).
 * - Para `kind="custo"`, valida e normaliza o número antes de salvar;
 *   valores inválidos mantêm o input aberto com sinalização de erro.
 * O componente gerencia o próprio estado e desmonta ao concluir, evitando
 * salvamentos duplicados entre Enter/blur.
 */
function InlineEditCell({
  kind,
  initialValue,
  align = "left",
  onSave,
  onCancel,
}: {
  kind: "custo" | "erp";
  initialValue: string;
  align?: "left" | "right";
  onSave: (normalized: string | number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState(false);
  const settled = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    if (settled.current) return;
    if (kind === "custo") {
      const parsed = parseCustoInput(value);
      if (parsed === null) {
        setError(true);
        inputRef.current?.focus();
        return; // mantém o input em edição
      }
      settled.current = true;
      onSave(parsed);
    } else {
      settled.current = true;
      onSave(value.trim());
    }
  };

  const cancel = () => {
    if (settled.current) return;
    settled.current = true;
    onCancel();
  };

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        if (error) setError(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      inputMode={kind === "custo" ? "decimal" : "text"}
      aria-invalid={error}
      placeholder={kind === "custo" ? "0,00" : "Código ERP"}
      className={cn(
        "h-7 py-1 text-sm",
        kind === "custo" && "font-mono",
        align === "right" && "text-right",
        error && "border-destructive focus-visible:ring-destructive",
      )}
    />
  );
}

export default function BaseDadosPage() {
  const { data: materials = [], isLoading: materialsLoading } = useMaterials();
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
  const [collapsedCategorias, setCollapsedCategorias] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importClearBefore, setImportClearBefore] = useState(false);
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
  const [bitolaSort, setBitolaSort] = useState<{ col: 'bitola' | 'erp' | 'custo'; dir: 'asc' | 'desc' }>({ col: 'bitola', dir: 'asc' });
  const [qualityFilters, setQualityFilters] = useState<Set<'sem_erp' | 'sem_custo' | 'sem_categoria'>>(new Set());
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'custo' | 'erp' } | null>(null);
  const queryClient = useQueryClient();

  const startInlineEdit = (id: string, field: 'custo' | 'erp') => {
    if (!canModifyBaseDados) return;
    setEditingCell({ id, field });
  };

  /**
   * Persiste a edição inline de uma célula (Custo ou ERP) com atualização
   * otimista: reflete o valor na UI imediatamente, faz rollback em caso de
   * erro e invalida a query ["materials"] em sucesso (via onSuccess do hook).
   * Não dispara update quando o valor não mudou.
   */
  const commitInlineEdit = async (
    m: (typeof materials)[number],
    field: 'custo' | 'erp',
    value: string | number,
  ) => {
    setEditingCell(null);
    const current = field === 'custo' ? m.custo : ((m as any).erp ?? '').toString().trim();
    if (value === current) return; // sem alteração → nenhuma chamada de update

    const previous = queryClient.getQueryData<any[]>(['materials']);
    queryClient.setQueryData<any[]>(['materials'], (old) =>
      (old ?? []).map((item) => (item.id === m.id ? { ...item, [field]: value } : item)),
    );

    try {
      await updateMaterial.mutateAsync({ id: m.id, [field]: value } as any);
      // sucesso: onSuccess do hook invalida ["materials"]; toast omitido p/ não poluir
    } catch {
      if (previous) queryClient.setQueryData(['materials'], previous); // rollback
      toast.error(
        field === 'custo'
          ? 'Erro ao salvar o custo. Alteração revertida.'
          : 'Erro ao salvar o ERP. Alteração revertida.',
      );
    }
  };

  const toggleQualityFilter = (key: 'sem_erp' | 'sem_custo' | 'sem_categoria') => {
    setQualityFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleBitolaSort = (col: 'bitola' | 'erp' | 'custo') => {
    setBitolaSort(prev =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'asc' }
    );
  };

  const handleImportXlsx = async (file: File, clearBefore: boolean) => {
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const MAX_ROWS = 5000;

    if (!canModifyBaseDados) {
      toast.error("Você não tem permissão para importar materiais.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande (máx. 5 MB).");
      return;
    }

    setImportDialogOpen(false);
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

      const importedRows = rows
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

      // Deduplicate by descricao+bitola (case-insensitive), keeping last occurrence
      const deduped = new Map<string, any>();
      for (const m of importedRows) {
        deduped.set(`${m.descricao.toLowerCase()}|||${m.bitola.toLowerCase()}`, m);
      }
      const uniqueMaterials = [...deduped.values()];

      if (uniqueMaterials.length === 0) {
        toast.error("Nenhum item válido encontrado na planilha");
        return;
      }

      // Conflict detection before writing
      const normalizeErpImport = (s: string) => s.replace(/\s+/g, "").toLowerCase();
      const conflictMessages: string[] = [];

      // Within-file: descricao+bitola duplicates (rows dropped by dedup)
      const internalKeyDupes = importedRows.length - uniqueMaterials.length;
      if (internalKeyDupes > 0) {
        conflictMessages.push(
          `${internalKeyDupes} linha(s) com família+bitola duplicada no arquivo — mantida a última ocorrência`,
        );
      }

      // Within-file: ERP duplicates across different descricao+bitola pairs
      const fileErpMap = new Map<string, string>();
      const fileErpDupes: string[] = [];
      for (const m of uniqueMaterials) {
        if (!m.erp) continue;
        const normErp = normalizeErpImport(m.erp);
        const label = `${m.descricao} ${m.bitola}`;
        if (fileErpMap.has(normErp)) {
          fileErpDupes.push(`"${m.erp}" (${label} e ${fileErpMap.get(normErp)})`);
        } else {
          fileErpMap.set(normErp, label);
        }
      }
      if (fileErpDupes.length > 0) {
        const examples = fileErpDupes.slice(0, 2).join("; ");
        conflictMessages.push(
          `${fileErpDupes.length} ERP(s) duplicado(s) no arquivo: ${examples}`,
        );
      }

      // Against existing DB (skipped when clearing before import)
      if (!clearBefore) {
        const existingErpMap = new Map<string, string>(); // normalized erp → label
        const existingKeySet = new Set<string>(); // normalized descricao|||bitola
        for (const m of materials) {
          const erp = ((m as any).erp ?? "").toString().trim();
          if (erp) existingErpMap.set(normalizeErpImport(erp), `${m.descricao} ${m.bitola}`);
          existingKeySet.add(
            `${m.descricao.toLowerCase().trim()}|||${m.bitola.toLowerCase().trim()}`,
          );
        }

        const dbKeyConflicts: string[] = [];
        const dbErpConflicts: string[] = [];
        for (const m of uniqueMaterials) {
          const key = `${m.descricao.toLowerCase()}|||${m.bitola.toLowerCase()}`;
          if (existingKeySet.has(key)) {
            dbKeyConflicts.push(`${m.descricao} ${m.bitola}`);
          } else if (m.erp) {
            // New key but ERP already used by a different existing item
            const normErp = normalizeErpImport(m.erp);
            if (existingErpMap.has(normErp)) {
              dbErpConflicts.push(
                `ERP "${m.erp}" (arquivo: ${m.descricao} ${m.bitola}, base: ${existingErpMap.get(normErp)})`,
              );
            }
          }
        }

        if (dbKeyConflicts.length > 0) {
          const examples = dbKeyConflicts.slice(0, 2).join(", ");
          conflictMessages.push(
            `${dbKeyConflicts.length} item(ns) já existente(s) na base serão atualizados (ex: ${examples})`,
          );
        }
        if (dbErpConflicts.length > 0) {
          const examples = dbErpConflicts.slice(0, 2).join("; ");
          conflictMessages.push(
            `${dbErpConflicts.length} conflito(s) de ERP com a base: ${examples}`,
          );
        }
      }

      if (conflictMessages.length > 0) {
        toast.warning(`Conflitos detectados: ${conflictMessages.join(" · ")}`, { duration: 8000 });
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

      if (clearBefore) {
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
      setImportFile(null);
      setImportClearBefore(false);
    }
  };

  const descriptions = useMemo(() => [...new Set(materials.map((m) => m.descricao))].sort(), [materials]);

  const qualityCounts = useMemo(() => ({
    sem_erp: materials.filter(m => !((m as any).erp?.toString().trim())).length,
    sem_custo: materials.filter(m => !m.custo || m.custo === 0).length,
    sem_categoria: materials.filter(m => !(m as any).categoria).length,
  }), [materials]);

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
        if (qualityFilters.has('sem_erp') && (m as any).erp?.toString().trim()) return false;
        if (qualityFilters.has('sem_custo') && m.custo > 0) return false;
        if (qualityFilters.has('sem_categoria') && (m as any).categoria) return false;
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
    [materials, search.debounced, descFilter, categoriaFilter, qualityFilters],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof materials>();
    filtered.forEach((m) => {
      const list = map.get(m.descricao) || [];
      list.push(m);
      map.set(m.descricao, list);
    });
    const dirMul = bitolaSort.dir === 'asc' ? 1 : -1;
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([desc, items]) => [
        desc,
        [...items].sort((a, b) => {
          if (bitolaSort.col === 'bitola') {
            return (parseBitolaValue(a.bitola) - parseBitolaValue(b.bitola)) * dirMul;
          }
          if (bitolaSort.col === 'custo') {
            return (a.custo - b.custo) * dirMul;
          }
          // erp: alfanumérico
          const ea = ((a as any).erp ?? '').toString();
          const eb = ((b as any).erp ?? '').toString();
          return ea.localeCompare(eb, 'pt-BR', { sensitivity: 'base' }) * dirMul;
        }),
      ] as [string, typeof materials]);
  }, [filtered, bitolaSort]);

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

  const toggleCategoria = (key: string) => {
    setCollapsedCategorias((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const collapseAllCategorias = () =>
    setCollapsedCategorias(new Set(groupedByCategoria.map(([k]) => k)));
  const expandAllCategorias = () => setCollapsedCategorias(new Set());

  const handleSave = async () => {
    const custo = parseBRL(form.custo);
    if (!form.descricao.trim() || !form.bitola.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Duplicate detection before persisting
    const normalizeErp = (s: string) => s.replace(/\s+/g, "").toLowerCase();
    const erpInput = normalizeErp(form.erp.trim());
    const descInput = form.descricao.trim().toLowerCase();
    const bitolaInput = form.bitola.trim().toLowerCase();

    for (const m of materials) {
      if (m.id === editingId) continue; // skip self when editing

      if (erpInput) {
        const existingErp = normalizeErp(((m as any).erp ?? "").toString());
        if (existingErp && existingErp === erpInput) {
          toast.error(
            `ERP "${form.erp.trim()}" já está cadastrado em "${m.descricao} — ${m.bitola}". Corrija o código antes de salvar.`,
          );
          return;
        }
      }

      if (
        m.descricao.trim().toLowerCase() === descInput &&
        m.bitola.trim().toLowerCase() === bitolaInput
      ) {
        toast.error(
          `A combinação família "${m.descricao}" + bitola "${m.bitola}" já existe na base. Edite o item existente.`,
        );
        return;
      }
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Importar / Exportar
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
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
              </DropdownMenuItem>
              {canModifyBaseDados && (
                <DropdownMenuItem
                  onClick={() => {
                    setImportFile(null);
                    setImportClearBefore(false);
                    setImportDialogOpen(true);
                  }}
                  disabled={importing}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {importing ? "Importando..." : "Importar XLSX"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {canModifyBaseDados && (
            <>
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

      <Dialog open={importDialogOpen} onOpenChange={(v) => { if (!importing) setImportDialogOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar XLSX</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="importFileInput">Arquivo (.xlsx / .xls)</Label>
              <input
                id="importFileInput"
                type="file"
                accept=".xlsx,.xls"
                className="mt-2 block w-full text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 cursor-pointer"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="importClearBefore"
                checked={importClearBefore}
                onCheckedChange={(v) => setImportClearBefore(!!v)}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="importClearBefore" className="cursor-pointer">
                  Limpar base antes de importar
                </Label>
                {importClearBefore && (
                  <p className="text-xs text-destructive mt-1">
                    Todos os materiais e itens de BOM existentes serão removidos permanentemente antes da importação.
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={importing}>Cancelar</Button>
            </DialogClose>
            <Button
              onClick={() => importFile && handleImportXlsx(importFile, importClearBefore)}
              disabled={!importFile || importing}
            >
              {importing ? "Importando..." : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <div className="sticky top-0 z-10 bg-background pb-2">
        <Card>
          <CardHeader className="pb-3">
            {/* Linha 1: busca + contador */}
            <div className="flex items-center gap-3">
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
              {!materialsLoading && (
                <span className="shrink-0 text-sm text-muted-foreground whitespace-nowrap">
                  {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
                </span>
              )}
            </div>

            {/* Linha 2: filtros + checkbox + ações */}
            <div className="flex flex-wrap gap-2 items-center mt-2">
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
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Filtros de qualidade */}
              <div className="flex flex-wrap gap-3 items-center">
                {(
                  [
                    { key: 'sem_erp', label: 'Sem ERP' },
                    { key: 'sem_custo', label: 'Sem custo' },
                    { key: 'sem_categoria', label: 'Sem categoria' },
                  ] as const
                ).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
                    <Checkbox
                      checked={qualityFilters.has(key)}
                      onCheckedChange={() => toggleQualityFilter(key)}
                      aria-label={`Filtrar: ${label}`}
                    />
                    <span>
                      {label}{" "}
                      <span className="text-xs text-muted-foreground/70">({qualityCounts[key]})</span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex gap-2 items-center ml-auto flex-wrap">
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
                <Button variant="outline" size="sm" onClick={expandAllCategorias}>
                  Expandir categorias
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAllCategorias}>
                  Recolher categorias
                </Button>
                <Button variant="outline" size="sm" onClick={expandAll}>
                  Expandir tudo
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAll}>
                  Recolher tudo
                </Button>
              </div>
            </div>

            {/* Chips de filtros ativos */}
            {(categoriaFilter !== "all" || descFilter !== "all" || qualityFilters.size > 0) && (
              <div className="flex flex-wrap gap-2 items-center mt-2 pt-2 border-t">
                {categoriaFilter !== "all" && (
                  <Badge variant="secondary" className="flex items-center gap-1 pr-1">
                    <span>Categoria: {categoriaFilter === "__none__" ? SEM_CATEGORIA_LABEL : categoriaFilter}</span>
                    <button
                      onClick={() => setCategoriaFilter("all")}
                      className="ml-1 rounded-sm hover:bg-muted p-0.5"
                      aria-label="Remover filtro de categoria"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {descFilter !== "all" && (
                  <Badge variant="secondary" className="flex items-center gap-1 pr-1">
                    <span>Família: {descFilter}</span>
                    <button
                      onClick={() => setDescFilter("all")}
                      className="ml-1 rounded-sm hover:bg-muted p-0.5"
                      aria-label="Remover filtro de família"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {(
                  [
                    { key: 'sem_erp', label: 'Sem ERP' },
                    { key: 'sem_custo', label: 'Sem custo' },
                    { key: 'sem_categoria', label: 'Sem categoria' },
                  ] as const
                ).filter(({ key }) => qualityFilters.has(key)).map(({ key, label }) => (
                  <Badge key={key} variant="secondary" className="flex items-center gap-1 pr-1">
                    <span>{label}</span>
                    <button
                      onClick={() => toggleQualityFilter(key)}
                      className="ml-1 rounded-sm hover:bg-muted p-0.5"
                      aria-label={`Remover filtro ${label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={() => { setCategoriaFilter("all"); setDescFilter("all"); setQualityFilters(new Set()); }}
                >
                  Limpar filtros
                </Button>
              </div>
            )}
          </CardHeader>
        </Card>
      </div>

      {materialsLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((ci) => (
            <Card key={ci}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-6 rounded" />
                  <Skeleton className="h-5 w-36 rounded" />
                  <Skeleton className="h-4 w-52 rounded" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {[0, 1, 2, 3].map((ri) => (
                    <div key={ri} className="flex items-center gap-4 py-2 px-1">
                      <Skeleton className="h-4 w-4 shrink-0 rounded" />
                      <Skeleton className="h-4 flex-1 rounded" />
                      <Skeleton className="h-4 w-10 rounded" />
                      <Skeleton className="h-4 w-28 rounded" />
                      <Skeleton className="h-4 w-20 rounded" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : grouped.length === 0 && materials.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="rounded-full bg-muted p-4">
                <Database className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Base de dados vazia</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  Cadastre a primeira família de materiais ou importe uma planilha XLSX para começar.
                </p>
              </div>
              {canModifyBaseDados && (
                <div className="flex gap-3 flex-wrap justify-center">
                  <Button
                    onClick={() => { setNewFamilyInput(""); setNewFamilyCategoria(""); setNewFamilyDialogOpen(true); }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Família
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setImportFile(null); setImportClearBefore(false); setImportDialogOpen(true); }}
                    disabled={importing}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Importar XLSX
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-muted-foreground">
                {search.debounced
                  ? <>Nenhum material encontrado para <strong>"{search.debounced}"</strong>.</>
                  : 'Nenhum material encontrado para os filtros selecionados.'}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  search.setInput("");
                  setCategoriaFilter("all");
                  setDescFilter("all");
                  setQualityFilters(new Set());
                }}
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Limpar busca/filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedByCategoria.map(([categoriaKey, families]) => {
            const categoriaLabel = categoriaKey === "__none__" ? SEM_CATEGORIA_LABEL : categoriaKey;
            const totalBitolas = families.reduce((sum, [, items]) => sum + items.length, 0);
            const isCategoriaCollapsed = collapsedCategorias.has(categoriaKey);
            const allCatItems = families.flatMap(([, items]) => items);
            const positiveCosts = allCatItems.map((m) => m.custo).filter((c) => c > 0);
            const costRange =
              positiveCosts.length > 0
                ? `${formatBRL(Math.min(...positiveCosts))} – ${formatBRL(Math.max(...positiveCosts))}`
                : "sem custo";
            return (
              <Card key={categoriaKey}>
                <CardHeader className="pb-3 sticky top-[8.5rem] z-[5] bg-card rounded-t-lg border-b">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => toggleCategoria(categoriaKey)}
                        aria-label={isCategoriaCollapsed ? `Expandir categoria ${categoriaLabel}` : `Recolher categoria ${categoriaLabel}`}
                      >
                        {isCategoriaCollapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <Badge
                        variant={categoriaKey === "__none__" ? "outline" : "secondary"}
                        className="text-sm"
                      >
                        {categoriaLabel}
                      </Badge>
                      <span className="text-sm text-muted-foreground truncate">
                        {families.length} {families.length === 1 ? "família" : "famílias"} · {totalBitolas} {totalBitolas === 1 ? "bitola" : "bitolas"} · {costRange}
                      </span>
                    </div>
                    {canModifyBaseDados && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          setNewFamilyInput("");
                          setNewFamilyCategoria(categoriaKey === "__none__" ? "" : categoriaKey);
                          setNewFamilyDialogOpen(true);
                        }}
                        aria-label={`Adicionar item em ${categoriaLabel}`}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar item
                      </Button>
                    )}
                  </div>
                </CardHeader>
                {!isCategoriaCollapsed && (
                <CardContent className="pt-0">
                  <Table className="table-fixed min-w-[640px]">
                    {/* Colgroup único compartilhado entre o nível família e o nível bitola
                        — garante alinhamento de Ø, Un., ERP, Custo, Notas e Ações em ambos. */}
                    <colgroup>
                      {canModifyBaseDados && <col className="w-10" />}
                      <col className="w-8" />
                      <col />
                      <col className="w-16" />
                      <col className="w-44" />
                      <col className="w-28" />
                      <col />
                      {canModifyBaseDados && <col className="w-28" />}
                    </colgroup>
                    <TableHeader>
                      <TableRow>
                        {canModifyBaseDados && <TableHead />}
                        <TableHead />
                        <TableHead>
                          <button
                            onClick={() => toggleBitolaSort('bitola')}
                            className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                          >
                            Ø
                            {bitolaSort.col === 'bitola' ? (
                              bitolaSort.dir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                            ) : null}
                          </button>
                        </TableHead>
                        <TableHead>Un.</TableHead>
                        <TableHead>
                          <button
                            onClick={() => toggleBitolaSort('erp')}
                            className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                          >
                            ERP
                            {bitolaSort.col === 'erp' ? (
                              bitolaSort.dir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                            ) : null}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button
                            onClick={() => toggleBitolaSort('custo')}
                            className="flex items-center gap-1 font-medium hover:text-foreground transition-colors ml-auto"
                          >
                            Custo
                            {bitolaSort.col === 'custo' ? (
                              bitolaSort.dir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                            ) : null}
                          </button>
                        </TableHead>
                        <TableHead>Notas</TableHead>
                        {canModifyBaseDados && <TableHead className="text-right">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {families.map(([descricao, items]) => {
                        const isExpanded = expandedGroups.has(descricao);
                        return (
                          <Fragment key={descricao}>
                            {/* Linha-pai: família */}
                            <TableRow
                              className="hover:bg-muted/50 cursor-pointer group"
                              onClick={() => toggleGroup(descricao)}
                            >
                              {canModifyBaseDados && (
                                <TableCell
                                  className="py-2 align-middle"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Checkbox
                                    checked={selectedFamilies.has(descricao)}
                                    onCheckedChange={() => toggleFamilySelection(descricao)}
                                    aria-label={`Selecionar família ${descricao}`}
                                  />
                                </TableCell>
                              )}
                              <TableCell className="py-2 align-middle pr-0">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell colSpan={5} className="font-medium py-2 align-middle">
                                {highlightMatch(descricao, search.debounced)}
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                  {items.length} {items.length === 1 ? "bitola" : "bitolas"}
                                </span>
                              </TableCell>
                              {canModifyBaseDados && (
                                <TableCell
                                  className="text-right py-2 align-middle"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-muted-foreground hover:text-foreground"
                                      onClick={() => openRenameFamily(descricao)}
                                      title="Renomear família"
                                    >
                                      <FolderPen className="h-3.5 w-3.5 mr-1" />
                                      <span className="text-xs">Renomear</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-muted-foreground hover:text-foreground"
                                      onClick={() => openNew(descricao)}
                                      title="Adicionar bitola a esta família"
                                    >
                                      <PlusCircle className="h-3.5 w-3.5 mr-1" />
                                      <span className="text-xs">Bitola</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-destructive hover:text-destructive"
                                      onClick={() => setDeleteFamilyTarget(descricao)}
                                      title="Excluir família"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>

                            {/* Linhas-filhas: bitolas (mesma tabela → colunas alinhadas) */}
                            {isExpanded &&
                              items.map((m) => {
                                const erpValue = ((m as any).erp ?? "").toString().trim();
                                const hasErp = erpValue.length > 0;
                                const hasCusto = m.custo > 0;
                                return (
                                  <TableRow
                                    key={m.id}
                                    className="bg-muted/30 hover:bg-muted/40"
                                  >
                                    {canModifyBaseDados && <TableCell className="py-1.5" />}
                                    <TableCell className="py-1.5" />
                                    <TableCell className="font-mono py-1.5 pl-6 border-l-2 border-primary/20">
                                      {highlightMatch(m.bitola, search.debounced)}
                                    </TableCell>
                                    <TableCell className="py-1.5">{m.unidade}</TableCell>
                                    <TableCell className="font-mono py-1.5">
                                      {canModifyBaseDados && editingCell?.id === m.id && editingCell.field === 'erp' ? (
                                        <InlineEditCell
                                          kind="erp"
                                          initialValue={((m as any).erp ?? '').toString()}
                                          onSave={(val) => commitInlineEdit(m, 'erp', val)}
                                          onCancel={() => setEditingCell(null)}
                                        />
                                      ) : (
                                        <div
                                          className={cn(
                                            'group/cell flex items-center gap-1',
                                            canModifyBaseDados && 'cursor-text',
                                          )}
                                          onDoubleClick={canModifyBaseDados ? () => startInlineEdit(m.id, 'erp') : undefined}
                                          title={canModifyBaseDados ? 'Duplo clique para editar' : undefined}
                                        >
                                          {hasErp ? (
                                            highlightMatch(erpValue, search.debounced)
                                          ) : (
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning cursor-help">
                                                  <AlertTriangle className="h-3 w-3" />
                                                  sem ERP
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                Código ERP não cadastrado para esta bitola.
                                              </TooltipContent>
                                            </Tooltip>
                                          )}
                                          {canModifyBaseDados && (
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); startInlineEdit(m.id, 'erp'); }}
                                              className="opacity-0 group-hover/cell:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
                                              aria-label="Editar ERP"
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right font-mono py-1.5">
                                      {canModifyBaseDados && editingCell?.id === m.id && editingCell.field === 'custo' ? (
                                        <InlineEditCell
                                          kind="custo"
                                          align="right"
                                          initialValue={m.custo ? String(m.custo).replace('.', ',') : ''}
                                          onSave={(val) => commitInlineEdit(m, 'custo', val)}
                                          onCancel={() => setEditingCell(null)}
                                        />
                                      ) : (
                                        <div
                                          className={cn(
                                            'group/cell flex items-center justify-end gap-1',
                                            canModifyBaseDados && 'cursor-text',
                                          )}
                                          onDoubleClick={canModifyBaseDados ? () => startInlineEdit(m.id, 'custo') : undefined}
                                          title={canModifyBaseDados ? 'Duplo clique para editar' : undefined}
                                        >
                                          {canModifyBaseDados && (
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); startInlineEdit(m.id, 'custo'); }}
                                              className="opacity-0 group-hover/cell:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
                                              aria-label="Editar custo"
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </button>
                                          )}
                                          {hasCusto ? (
                                            formatBRL(m.custo)
                                          ) : (
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span className="inline-flex items-center gap-1 rounded-md border border-info/40 bg-info/10 px-1.5 py-0.5 text-xs font-medium text-info cursor-help">
                                                  <Info className="h-3 w-3" />
                                                  sem custo
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                Custo ausente ou igual a R$ 0,00.
                                              </TooltipContent>
                                            </Tooltip>
                                          )}
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground py-1.5 truncate">
                                      {(m as any).notas || "-"}
                                    </TableCell>
                                    {canModifyBaseDados && (
                                      <TableCell className="py-1.5">
                                        <div className="flex justify-end gap-1">
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
                                );
                              })}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

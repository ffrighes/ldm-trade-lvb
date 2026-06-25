import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useMaterials, useAddMaterial, useUpdateMaterial, useDeleteMaterial } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ChevronUp, Upload, Download, PlusCircle, FolderPen, Tags, X, AlertTriangle, Info, Database, Copy, ArrowRight } from "lucide-react";
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
import { normalizeForSearch } from "@/lib/normalizeSearch";
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
import { useBaseDadosUiState } from "@/hooks/useBaseDadosUiState";
import { Badge } from "@/components/ui/badge";
import { useVirtualizer, defaultRangeExtractor } from "@tanstack/react-virtual";
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
 * Material normalizado a partir de uma linha do XLSX, pronto para gravação
 * via upsert (mesmo formato do caminho de importação existente).
 */
type ImportMaterial = {
  descricao: string;
  bitola: string;
  unidade: string;
  erp: string;
  custo: number;
  notas: string;
  categoria: string | null;
};

/** Uma alteração de campo detectada entre o item da base e o item do arquivo. */
type FieldChange = { field: string; from: string; to: string };

/** Linha recusada na pré-visualização (não será gravada). */
type ImportError = { row: number | null; label: string; motivo: string };

/**
 * Resultado da pré-visualização da importação. Calculado SEM gravar nada.
 * `toWrite` contém apenas as linhas válidas e desduplicadas que serão
 * efetivamente persistidas ao confirmar (novos + atualizações + inalterados).
 */
type ImportPreview = {
  clearBefore: boolean;
  novos: ImportMaterial[];
  atualizacoes: Array<{ material: ImportMaterial; changes: FieldChange[] }>;
  inalterados: number;
  erros: ImportError[];
  avisos: string[];
  toWrite: ImportMaterial[];
  novasCategorias: string[];
  removeCount: number;
};

/**
 * Normaliza um custo vindo do XLSX (número nativo da célula ou string em
 * formato pt-BR) para número não-negativo. Retorna:
 * - `0` quando vazio (custo opcional);
 * - `null` quando inválido (texto não numérico, negativo) → vira erro.
 */
function parseImportCusto(raw: unknown): number | null {
  if (raw === "" || raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return isFinite(raw) && raw >= 0 ? raw : null;
  const s = String(raw).trim();
  if (s === "") return 0;
  const cleaned = s.replace(/[R$\s.]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = parseFloat(cleaned);
  return isFinite(n) && n >= 0 ? n : null;
}

/**
 * Compara um material existente na base com a versão vinda do arquivo e
 * retorna a lista de campos que mudariam num upsert. A chave (família+bitola)
 * já é considerada igual; só comparamos os campos atualizáveis.
 */
function diffMaterial(existing: any, m: ImportMaterial): FieldChange[] {
  const changes: FieldChange[] = [];
  const exErp = ((existing.erp ?? "") as string).toString().trim();
  const exNotas = ((existing.notas ?? "") as string).toString().trim();
  const exCat = (existing.categoria ?? null) as string | null;
  const fmt = (v: string | null) => (v == null || v === "" ? "—" : v);

  if ((existing.unidade ?? "") !== m.unidade) {
    changes.push({ field: "Unidade", from: fmt(existing.unidade ?? ""), to: fmt(m.unidade) });
  }
  if (exErp !== m.erp) {
    changes.push({ field: "ERP", from: fmt(exErp), to: fmt(m.erp) });
  }
  if (Number(existing.custo ?? 0) !== m.custo) {
    changes.push({ field: "Custo", from: formatBRL(Number(existing.custo ?? 0)), to: formatBRL(m.custo) });
  }
  if (exNotas !== m.notas) {
    changes.push({ field: "Notas", from: fmt(exNotas), to: fmt(m.notas) });
  }
  if ((exCat ?? "") !== (m.categoria ?? "")) {
    changes.push({ field: "Categoria", from: fmt(exCat), to: fmt(m.categoria) });
  }
  return changes;
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

  const {
    initialSearch,
    setSearchParam,
    categoriaFilter,
    setCategoriaFilter,
    descFilter,
    setDescFilter,
    qualityFilters,
    setQualityFilters,
    expandedGroups,
    setExpandedGroups,
    collapsedCategorias,
    setCollapsedCategorias,
  } = useBaseDadosUiState();

  const search = useSearch({
    debounceMs: 300,
    storageKey: "materiais:recent-searches",
    initialValue: initialSearch,
  });

  // Reflete o termo de busca atual na URL (persistência / link compartilhável).
  useEffect(() => {
    setSearchParam(search.input);
  }, [search.input, setSearchParam]);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ descricao: "", bitola: "", unidade: "m", erp: "", custo: "", notas: "", categoria: "" });
  const [newFamilyCategoria, setNewFamilyCategoria] = useState<string>("");
  const [editingFamilyCategoria, setEditingFamilyCategoria] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importClearBefore, setImportClearBefore] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [previewTab, setPreviewTab] = useState<"novos" | "atualizacoes" | "erros">("novos");
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
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [batchDeleteSaving, setBatchDeleteSaving] = useState(false);
  const [bitolaSort, setBitolaSort] = useState<{ col: 'bitola' | 'erp' | 'custo'; dir: 'asc' | 'desc' }>({ col: 'bitola', dir: 'asc' });
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

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const MAX_ROWS = 5000;

  /**
   * Faz o parse do XLSX e calcula o diff contra a base — SEM gravar nada.
   * Classifica cada linha em Novos / Atualizações / Erros e detecta avisos
   * (ERPs duplicados). Lança Error em falhas de parse / limites.
   */
  const buildImportPreview = async (file: File, clearBefore: boolean): Promise<ImportPreview> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (rows.length > MAX_ROWS) {
      throw new Error(`Planilha muito grande (máx. ${MAX_ROWS} linhas).`);
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

    const erros: ImportError[] = [];
    const valids: ImportMaterial[] = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2; // +1 cabeçalho, +1 base 1
      const mapped: any = {};
      for (const [key, value] of Object.entries(row)) {
        const field = headerMap[key.trim()];
        if (field) mapped[field] = value;
      }
      const descricao = String(mapped.descricao ?? "").trim();
      const bitola = String(mapped.bitola ?? "").trim();

      const missing: string[] = [];
      if (!descricao) missing.push("Descrição (Família)");
      if (!bitola) missing.push("Ø (Bitola)");
      if (missing.length > 0) {
        erros.push({
          row: rowNum,
          label: descricao || bitola || "(linha vazia)",
          motivo: `Campo(s) obrigatório(s) ausente(s): ${missing.join(", ")}`,
        });
        return;
      }

      const custo = parseImportCusto(mapped.custo);
      if (custo === null) {
        erros.push({
          row: rowNum,
          label: `${descricao} ${bitola}`,
          motivo: `Custo inválido: "${String(mapped.custo).trim()}"`,
        });
        return;
      }

      const unRaw = String(mapped.unidade || "un").trim();
      const catRaw = String(mapped.categoria || "").trim();
      valids.push({
        descricao,
        bitola,
        unidade: unRaw === "M" ? "m" : unRaw === "STK" ? "un" : unRaw.toLowerCase() || "un",
        erp: String(mapped.erp || "").trim(),
        custo,
        notas: String(mapped.notas || "").trim(),
        categoria: catRaw || null,
      });
    });

    // Desduplica por família+bitola (case-insensitive), mantendo a última
    // ocorrência. As ocorrências anteriores viram erro (duplicata interna).
    const deduped = new Map<string, ImportMaterial>();
    for (const m of valids) {
      const key = `${m.descricao.toLowerCase()}|||${m.bitola.toLowerCase()}`;
      if (deduped.has(key)) {
        erros.push({
          row: null,
          label: `${m.descricao} ${m.bitola}`,
          motivo: "Duplicata interna do arquivo (família+bitola) — mantida a última ocorrência",
        });
      }
      deduped.set(key, m);
    }
    const uniqueMaterials = [...deduped.values()];

    // Avisos: ERPs duplicados (no arquivo e contra a base). Não bloqueiam a
    // gravação — o upsert prossegue —, mas são sinalizados ao usuário.
    const normalizeErp = (s: string) => s.replace(/\s+/g, "").toLowerCase();
    const avisos: string[] = [];

    const fileErpMap = new Map<string, string>();
    const fileErpDupes: string[] = [];
    for (const m of uniqueMaterials) {
      if (!m.erp) continue;
      const normErp = normalizeErp(m.erp);
      const label = `${m.descricao} ${m.bitola}`;
      if (fileErpMap.has(normErp)) {
        fileErpDupes.push(`"${m.erp}" (${label} e ${fileErpMap.get(normErp)})`);
      } else {
        fileErpMap.set(normErp, label);
      }
    }
    if (fileErpDupes.length > 0) {
      avisos.push(`${fileErpDupes.length} ERP(s) duplicado(s) no arquivo: ${fileErpDupes.slice(0, 3).join("; ")}`);
    }

    // Classificação contra a base (ignorada quando "limpar base" está marcado,
    // pois tudo será inserido do zero).
    const novos: ImportMaterial[] = [];
    const atualizacoes: Array<{ material: ImportMaterial; changes: FieldChange[] }> = [];
    let inalterados = 0;

    if (clearBefore) {
      novos.push(...uniqueMaterials);
    } else {
      const existingByKey = new Map<string, any>();
      const existingErpMap = new Map<string, string>();
      for (const m of materials) {
        existingByKey.set(`${m.descricao.toLowerCase().trim()}|||${m.bitola.toLowerCase().trim()}`, m);
        const erp = ((m as any).erp ?? "").toString().trim();
        if (erp) existingErpMap.set(normalizeErp(erp), `${m.descricao} ${m.bitola}`);
      }

      const dbErpConflicts: string[] = [];
      for (const m of uniqueMaterials) {
        const key = `${m.descricao.toLowerCase()}|||${m.bitola.toLowerCase()}`;
        const existing = existingByKey.get(key);
        if (!existing) {
          novos.push(m);
          if (m.erp && existingErpMap.has(normalizeErp(m.erp))) {
            dbErpConflicts.push(
              `ERP "${m.erp}" (arquivo: ${m.descricao} ${m.bitola}, base: ${existingErpMap.get(normalizeErp(m.erp))})`,
            );
          }
          continue;
        }
        const changes = diffMaterial(existing, m);
        if (changes.length > 0) atualizacoes.push({ material: m, changes });
        else inalterados++;
      }
      if (dbErpConflicts.length > 0) {
        avisos.push(`${dbErpConflicts.length} conflito(s) de ERP com a base: ${dbErpConflicts.slice(0, 3).join("; ")}`);
      }
    }

    const novasCategorias = [
      ...new Set(
        uniqueMaterials
          .map((m) => m.categoria)
          .filter((c): c is string => !!c && !categorias.includes(c)),
      ),
    ];

    return {
      clearBefore,
      novos,
      atualizacoes,
      inalterados,
      erros,
      avisos,
      toWrite: uniqueMaterials,
      novasCategorias,
      removeCount: clearBefore ? materials.length : 0,
    };
  };

  /**
   * Etapa 1: ao confirmar a seleção do arquivo, gera a pré-visualização
   * (sem gravar) e abre o Dialog de revisão.
   */
  const handleGeneratePreview = async (file: File, clearBefore: boolean) => {
    if (!canModifyBaseDados) {
      toast.error("Você não tem permissão para importar materiais.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande (máx. 5 MB).");
      return;
    }

    setPreviewLoading(true);
    try {
      const preview = await buildImportPreview(file, clearBefore);
      if (preview.toWrite.length === 0) {
        toast.error(
          preview.erros.length > 0
            ? "Nenhum item válido na planilha — verifique os erros."
            : "Nenhum item válido encontrado na planilha",
        );
        return;
      }
      setImportPreview(preview);
      setPreviewTab(
        preview.novos.length > 0 ? "novos" : preview.atualizacoes.length > 0 ? "atualizacoes" : "erros",
      );
      setImportDialogOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao ler a planilha: " + (err.message || "erro desconhecido"));
    } finally {
      setPreviewLoading(false);
    }
  };

  /**
   * Etapa 2: grava de fato. Reaproveita o caminho de importação existente
   * (upsert de categorias, opção de limpar base, upsert em lote). Apenas as
   * linhas válidas (`toWrite`) são persistidas; erros já foram descartados.
   */
  const handleConfirmImport = async () => {
    if (!importPreview) return;
    const { toWrite, novasCategorias, clearBefore } = importPreview;

    setImporting(true);
    try {
      if (novasCategorias.length > 0) {
        const { error: catError } = await supabase
          .from("material_categorias" as never)
          .upsert(novasCategorias.map((nome) => ({ nome })) as never, { onConflict: "nome" });
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
      for (let i = 0; i < toWrite.length; i += batchSize) {
        const batch = toWrite.slice(i, i + batchSize);
        const { error } = await supabase.from("materials").upsert(batch as any[], { onConflict: "descricao,bitola" });
        if (error) throw error;
        inserted += batch.length;
      }

      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success(`${inserted} itens importados com sucesso`);
      setImportPreview(null);
      setImportFile(null);
      setImportClearBefore(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao importar: " + (err.message || "erro desconhecido"));
    } finally {
      setImporting(false);
    }
  };

  /** Monta o texto da lista de erros para copiar / baixar. */
  const buildErrorReport = (erros: ImportError[]) =>
    erros.map((e) => `${e.row != null ? `Linha ${e.row}` : "—"}\t${e.label}\t${e.motivo}`).join("\n");

  const handleCopyErrors = async () => {
    if (!importPreview) return;
    try {
      await navigator.clipboard.writeText(
        "Linha\tItem\tMotivo\n" + buildErrorReport(importPreview.erros),
      );
      toast.success("Lista de erros copiada");
    } catch {
      toast.error("Não foi possível copiar a lista");
    }
  };

  const handleDownloadErrors = () => {
    if (!importPreview) return;
    const content = "Linha\tItem\tMotivo\n" + buildErrorReport(importPreview.erros);
    const blob = new Blob([content], { type: "text/tab-separated-values;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "erros-importacao.tsv";
    a.click();
    URL.revokeObjectURL(url);
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
          const s = normalizeForSearch(search.debounced);
          return (
            normalizeForSearch(m.descricao).includes(s) ||
            normalizeForSearch(m.bitola).includes(s) ||
            normalizeForSearch((m as any).erp ?? '').includes(s)
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

  /**
   * Achata a estrutura hierárquica visível (categoria → família → bitolas) em
   * uma lista linear de linhas, para virtualização. Só entram as linhas de fato
   * visíveis: cabeçalho da categoria sempre; cabeçalho de colunas + famílias
   * apenas quando a categoria não está recolhida; bitolas apenas das famílias
   * expandidas. Assim, virtualizamos sobre `flatRows` renderizando somente o
   * que está no viewport, mesmo com milhares de bitolas.
   */
  type FlatRow =
    | {
        kind: 'category';
        id: string;
        categoriaKey: string;
        categoriaLabel: string;
        familiesCount: number;
        totalBitolas: number;
        costRange: string;
        isCollapsed: boolean;
      }
    | { kind: 'colheader'; id: string; categoriaKey: string }
    | { kind: 'family'; id: string; categoriaKey: string; descricao: string; items: typeof materials }
    | { kind: 'bitola'; id: string; descricao: string; material: (typeof materials)[number] };

  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = [];
    for (const [categoriaKey, families] of groupedByCategoria) {
      const categoriaLabel = categoriaKey === "__none__" ? SEM_CATEGORIA_LABEL : categoriaKey;
      const totalBitolas = families.reduce((sum, [, items]) => sum + items.length, 0);
      const isCollapsed = collapsedCategorias.has(categoriaKey);
      const positiveCosts: number[] = [];
      for (const [, items] of families)
        for (const m of items) if (m.custo > 0) positiveCosts.push(m.custo);
      const costRange =
        positiveCosts.length > 0
          ? `${formatBRL(Math.min(...positiveCosts))} – ${formatBRL(Math.max(...positiveCosts))}`
          : "sem custo";

      rows.push({
        kind: 'category',
        id: `cat:${categoriaKey}`,
        categoriaKey,
        categoriaLabel,
        familiesCount: families.length,
        totalBitolas,
        costRange,
        isCollapsed,
      });
      if (isCollapsed) continue;

      rows.push({ kind: 'colheader', id: `colh:${categoriaKey}`, categoriaKey });
      for (const [descricao, items] of families) {
        rows.push({ kind: 'family', id: `fam:${categoriaKey}:${descricao}`, categoriaKey, descricao, items });
        if (expandedGroups.has(descricao)) {
          for (const m of items) rows.push({ kind: 'bitola', id: `bit:${m.id}`, descricao, material: m });
        }
      }
    }
    return rows;
  }, [groupedByCategoria, collapsedCategorias, expandedGroups]);

  // Índices das linhas de cabeçalho de categoria — usados para mantê-las
  // "grudadas" (sticky) no topo enquanto se rola dentro de cada grupo.
  const stickyIndexes = useMemo(() => {
    const idx: number[] = [];
    flatRows.forEach((r, i) => {
      if (r.kind === 'category') idx.push(i);
    });
    return idx;
  }, [flatRows]);

  const activeStickyIndexRef = useRef(0);
  const listScrollRef = useRef<HTMLDivElement>(null);

  const rangeExtractor = useCallback(
    (range: { startIndex: number; endIndex: number; overscan: number; count: number }) => {
      let active = 0;
      for (const i of stickyIndexes) {
        if (i <= range.startIndex) active = i;
        else break;
      }
      activeStickyIndexRef.current = active;
      const next = new Set<number>([active, ...defaultRangeExtractor(range)]);
      return [...next].sort((a, b) => a - b);
    },
    [stickyIndexes],
  );

  const rowVirtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: (index) => {
      const r = flatRows[index];
      if (!r) return 44;
      switch (r.kind) {
        case 'category':
          return 60;
        case 'colheader':
          return 40;
        case 'family':
          return 44;
        default:
          return 40;
      }
    },
    overscan: 10,
    getItemKey: (index) => flatRows[index]?.id ?? index,
    rangeExtractor,
  });

  // Grade de colunas compartilhada por cabeçalho de colunas, famílias e bitolas
  // — mantém o alinhamento de Ø, Un., ERP, Custo, Notas e Ações entre os níveis.
  const gridColsClass = canModifyBaseDados
    ? "grid grid-cols-[2.5rem_2rem_minmax(0,1fr)_4rem_11rem_7rem_minmax(0,1.6fr)_7rem]"
    : "grid grid-cols-[2rem_minmax(0,1fr)_4rem_11rem_7rem_minmax(0,1.6fr)]";

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

  const selectedBitolaCount = useMemo(
    () => materials.filter((m) => selectedFamilies.has(m.descricao)).length,
    [materials, selectedFamilies],
  );

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

  const handleBatchDeleteFamilies = async () => {
    if (selectedFamilies.size === 0) return;
    setBatchDeleteSaving(true);
    try {
      const families = [...selectedFamilies];

      // 1. Obter IDs dos materiais das famílias selecionadas
      const { data: familyMaterials, error: fetchError } = await supabase
        .from("materials")
        .select("id")
        .in("descricao", families);
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
      const { error } = await supabase.from("materials").delete().in("descricao", families);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      toast.success(
        `${families.length} ${families.length === 1 ? "família excluída" : "famílias excluídas"}`,
      );
      setSelectedFamilies(new Set());
      setBatchDeleteConfirmOpen(false);
    } catch (err: any) {
      toast.error("Erro ao excluir famílias: " + (err.message || "erro desconhecido"));
    } finally {
      setBatchDeleteSaving(false);
    }
  };

  const handleExportSelection = () => {
    const exportData = materials
      .filter((m) => selectedFamilies.has(m.descricao))
      .map((m) => ({
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
    XLSX.writeFile(wb, "selecao-materiais.xlsx");
    toast.success("Seleção exportada");
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

      <Dialog open={importDialogOpen} onOpenChange={(v) => { if (!previewLoading) setImportDialogOpen(v); }}>
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
                className="mt-2 block w-full text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-none file:border-0 file:text-sm file:font-medium file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 cursor-pointer"
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
              <Button variant="outline" disabled={previewLoading}>Cancelar</Button>
            </DialogClose>
            <Button
              onClick={() => importFile && handleGeneratePreview(importFile, importClearBefore)}
              disabled={!importFile || previewLoading}
            >
              {previewLoading ? "Analisando..." : "Pré-visualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!importPreview}
        onOpenChange={(v) => { if (!v && !importing) setImportPreview(null); }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Pré-visualização da importação</DialogTitle>
          </DialogHeader>

          {importPreview && (
            <div className="flex flex-col gap-4 overflow-hidden">
              {/* Aviso de limpeza da base */}
              {importPreview.clearBefore && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2.5">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                  <div className="text-sm text-destructive">
                    <strong>Limpar base antes de importar está ativado.</strong> Os{" "}
                    <strong>{importPreview.removeCount}</strong> itens atuais (e os itens de BOM
                    vinculados) serão <strong>apagados permanentemente</strong> antes da gravação dos{" "}
                    <strong>{importPreview.toWrite.length}</strong> itens da planilha.
                  </div>
                </div>
              )}

              {/* Contadores por categoria */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { key: "novos", label: "Novos", value: importPreview.novos.length, cls: "text-emerald-600 dark:text-emerald-400" },
                  { key: "atualizacoes", label: "Atualizações", value: importPreview.atualizacoes.length, cls: "text-amber-600 dark:text-amber-400" },
                  { key: "inalterados", label: "Inalterados", value: importPreview.inalterados, cls: "text-muted-foreground" },
                  { key: "erros", label: "Erros", value: importPreview.erros.length, cls: "text-destructive" },
                ] as const).map((c) => (
                  <div key={c.key} className="rounded-lg border px-3 py-2 text-center">
                    <div className={cn("text-2xl font-bold", c.cls)}>{c.value}</div>
                    <div className="text-xs text-muted-foreground">{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Avisos (ERP) */}
              {importPreview.avisos.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <ul className="space-y-0.5">
                    {importPreview.avisos.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}

              {/* Abas */}
              <div className="flex gap-1 border-b">
                {([
                  { key: "novos", label: `Novos (${importPreview.novos.length})` },
                  { key: "atualizacoes", label: `Atualizações (${importPreview.atualizacoes.length})` },
                  { key: "erros", label: `Erros (${importPreview.erros.length})` },
                ] as const).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setPreviewTab(t.key)}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                      previewTab === t.key
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Conteúdo das abas */}
              <div className="overflow-y-auto min-h-[8rem] max-h-[40vh] border rounded-md">
                {previewTab === "novos" && (
                  importPreview.novos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum item novo.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Família</TableHead>
                          <TableHead>Ø</TableHead>
                          <TableHead>ERP</TableHead>
                          <TableHead className="text-right">Custo</TableHead>
                          <TableHead>Categoria</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.novos.map((m, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{m.descricao}</TableCell>
                            <TableCell>{m.bitola}</TableCell>
                            <TableCell className="font-mono text-xs">{m.erp || "—"}</TableCell>
                            <TableCell className="text-right font-mono">{formatBRL(m.custo)}</TableCell>
                            <TableCell>{m.categoria || SEM_CATEGORIA_LABEL}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                )}

                {previewTab === "atualizacoes" && (
                  importPreview.atualizacoes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atualização.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Família</TableHead>
                          <TableHead>Ø</TableHead>
                          <TableHead>Alterações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.atualizacoes.map(({ material, changes }, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{material.descricao}</TableCell>
                            <TableCell>{material.bitola}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {changes.map((ch, j) => (
                                  <div key={j} className="flex items-center gap-1.5 text-xs flex-wrap">
                                    <span className="font-medium">{ch.field}:</span>
                                    <span className="text-muted-foreground line-through">{ch.from}</span>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-foreground font-medium">{ch.to}</span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                )}

                {previewTab === "erros" && (
                  importPreview.erros.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum erro encontrado.</p>
                  ) : (
                    <div>
                      <div className="flex items-center justify-end gap-2 p-2 border-b bg-muted/30">
                        <Button variant="outline" size="sm" className="h-7" onClick={handleCopyErrors}>
                          <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
                        </Button>
                        <Button variant="outline" size="sm" className="h-7" onClick={handleDownloadErrors}>
                          <Download className="h-3.5 w-3.5 mr-1.5" /> Baixar
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Linha</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead>Motivo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importPreview.erros.map((e, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-muted-foreground">{e.row ?? "—"}</TableCell>
                              <TableCell className="font-medium">{e.label}</TableCell>
                              <TableCell className="text-xs text-destructive">{e.motivo}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                {importPreview.erros.length > 0 && (
                  <>As <strong>{importPreview.erros.length}</strong> linha(s) com erro serão ignoradas. </>
                )}
                Serão gravados <strong>{importPreview.toWrite.length}</strong> item(ns).
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportPreview(null)} disabled={importing}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={importing || !importPreview || importPreview.toWrite.length === 0}
              className={importPreview?.clearBefore ? "bg-destructive hover:bg-destructive/90" : undefined}
            >
              {importing
                ? "Importando..."
                : importPreview?.clearBefore
                  ? `Limpar base e importar (${importPreview.toWrite.length})`
                  : `Confirmar importação (${importPreview?.toWrite.length ?? 0})`}
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
          <div className="text-sm font-medium shrink-0">
            {selectedFamilies.size} {selectedFamilies.size === 1 ? "família selecionada" : "famílias selecionadas"}
          </div>
          <div className="flex flex-1 flex-wrap gap-2 sm:items-center">
            <Label className="text-sm text-muted-foreground sm:ml-2 shrink-0">Alterar categoria para:</Label>
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
            <Button onClick={() => setBatchConfirmOpen(true)} disabled={batchSaving || batchDeleteSaving}>
              Aplicar
            </Button>
            <div className="sm:ml-auto flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleExportSelection} disabled={batchDeleteSaving}>
                <Download className="h-4 w-4 mr-1.5" />
                Exportar seleção
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBatchDeleteConfirmOpen(true)}
                disabled={batchSaving || batchDeleteSaving}
                className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Excluir selecionadas
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection} disabled={batchSaving || batchDeleteSaving}>
                Limpar seleção
              </Button>
            </div>
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

      <AlertDialog open={batchDeleteConfirmOpen} onOpenChange={(v) => { if (!batchDeleteSaving) setBatchDeleteConfirmOpen(v); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir famílias selecionadas?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selectedFamilies.size}</strong>{" "}
              {selectedFamilies.size === 1 ? "família" : "famílias"} e{" "}
              <strong>{selectedBitolaCount}</strong>{" "}
              {selectedBitolaCount === 1 ? "bitola serão removidas" : "bitolas serão removidas"}{" "}
              permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchDeleteSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDeleteFamilies}
              disabled={batchDeleteSaving}
              className="bg-destructive hover:bg-destructive/90"
            >
              {batchDeleteSaving ? "Excluindo..." : "Excluir"}
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
                  <Skeleton className="h-6 w-6 rounded-none" />
                  <Skeleton className="h-5 w-36 rounded-none" />
                  <Skeleton className="h-4 w-52 rounded-none" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {[0, 1, 2, 3].map((ri) => (
                    <div key={ri} className="flex items-center gap-4 py-2 px-1">
                      <Skeleton className="h-4 w-4 shrink-0 rounded-none" />
                      <Skeleton className="h-4 flex-1 rounded-none" />
                      <Skeleton className="h-4 w-10 rounded-none" />
                      <Skeleton className="h-4 w-28 rounded-none" />
                      <Skeleton className="h-4 w-20 rounded-none" />
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
              <div className="rounded-none bg-muted p-4">
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
        <Card className="overflow-hidden">
          <div
            ref={listScrollRef}
            className="overflow-auto h-[calc(100vh-16rem)] min-h-[24rem]"
            role="table"
            aria-label="Materiais agrupados por categoria e família"
            aria-rowcount={flatRows.length}
          >
            <div
              className="relative w-full min-w-[680px]"
              style={{ height: rowVirtualizer.getTotalSize() }}
            >
              {rowVirtualizer.getVirtualItems().map((vItem) => {
                const row = flatRows[vItem.index];
                if (!row) return null;
                const isActiveSticky =
                  row.kind === 'category' && activeStickyIndexRef.current === vItem.index;
                const baseStyle: React.CSSProperties = isActiveSticky
                  ? { position: 'sticky', top: 0, left: 0, width: '100%', zIndex: 3 }
                  : {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vItem.start}px)`,
                    };

                if (row.kind === 'category') {
                  return (
                    <div
                      key={vItem.key}
                      data-index={vItem.index}
                      ref={rowVirtualizer.measureElement}
                      role="row"
                      aria-expanded={!row.isCollapsed}
                      style={baseStyle}
                      className="border-b bg-card"
                    >
                      <div className="flex items-center gap-2 px-3 py-2.5" role="cell">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => toggleCategoria(row.categoriaKey)}
                          aria-label={row.isCollapsed ? `Expandir categoria ${row.categoriaLabel}` : `Recolher categoria ${row.categoriaLabel}`}
                        >
                          {row.isCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        <Badge
                          variant={row.categoriaKey === "__none__" ? "outline" : "secondary"}
                          className="text-sm"
                        >
                          {row.categoriaLabel}
                        </Badge>
                        <span className="text-sm text-muted-foreground truncate">
                          {row.familiesCount} {row.familiesCount === 1 ? "família" : "famílias"} · {row.totalBitolas} {row.totalBitolas === 1 ? "bitola" : "bitolas"} · {row.costRange}
                        </span>
                        {canModifyBaseDados && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 ml-auto"
                            onClick={() => {
                              setNewFamilyInput("");
                              setNewFamilyCategoria(row.categoriaKey === "__none__" ? "" : row.categoriaKey);
                              setNewFamilyDialogOpen(true);
                            }}
                            aria-label={`Adicionar item em ${row.categoriaLabel}`}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Adicionar item
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                }

                if (row.kind === 'colheader') {
                  return (
                    <div
                      key={vItem.key}
                      data-index={vItem.index}
                      ref={rowVirtualizer.measureElement}
                      role="row"
                      style={baseStyle}
                      className={cn(gridColsClass, "items-center border-b bg-muted/40 px-1 py-1.5 text-xs font-medium text-muted-foreground")}
                    >
                      {canModifyBaseDados && <div role="columnheader" />}
                      <div role="columnheader" />
                      <div role="columnheader" className="px-1">
                        <button
                          onClick={() => toggleBitolaSort('bitola')}
                          className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                        >
                          Ø
                          {bitolaSort.col === 'bitola' ? (
                            bitolaSort.dir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                          ) : null}
                        </button>
                      </div>
                      <div role="columnheader" className="px-1">Un.</div>
                      <div role="columnheader" className="px-1">
                        <button
                          onClick={() => toggleBitolaSort('erp')}
                          className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                        >
                          ERP
                          {bitolaSort.col === 'erp' ? (
                            bitolaSort.dir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                          ) : null}
                        </button>
                      </div>
                      <div role="columnheader" className="px-1 text-right">
                        <button
                          onClick={() => toggleBitolaSort('custo')}
                          className="flex items-center gap-1 font-medium hover:text-foreground transition-colors ml-auto"
                        >
                          Custo
                          {bitolaSort.col === 'custo' ? (
                            bitolaSort.dir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                          ) : null}
                        </button>
                      </div>
                      <div role="columnheader" className="px-1">Notas</div>
                      {canModifyBaseDados && <div role="columnheader" className="px-1 text-right">Ações</div>}
                    </div>
                  );
                }

                if (row.kind === 'family') {
                  const { descricao, items } = row;
                  const isExpanded = expandedGroups.has(descricao);
                  return (
                    <div
                      key={vItem.key}
                      data-index={vItem.index}
                      ref={rowVirtualizer.measureElement}
                      role="row"
                      aria-expanded={isExpanded}
                      style={baseStyle}
                      className={cn(gridColsClass, "group items-center border-b bg-card px-1 hover:bg-muted/50 cursor-pointer")}
                      onClick={() => toggleGroup(descricao)}
                    >
                      {canModifyBaseDados && (
                        <div
                          role="cell"
                          className="flex items-center justify-center py-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={selectedFamilies.has(descricao)}
                            onCheckedChange={() => toggleFamilySelection(descricao)}
                            aria-label={`Selecionar família ${descricao}`}
                          />
                        </div>
                      )}
                      <div role="cell" className="flex items-center py-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div role="cell" className="col-span-5 font-medium py-2 px-1 truncate">
                        {highlightMatch(descricao, search.debounced)}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {items.length} {items.length === 1 ? "bitola" : "bitolas"}
                        </span>
                      </div>
                      {canModifyBaseDados && (
                        <div
                          role="cell"
                          className="flex justify-end py-2"
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
                        </div>
                      )}
                    </div>
                  );
                }

                const m = row.material;
                const erpValue = ((m as any).erp ?? "").toString().trim();
                const hasErp = erpValue.length > 0;
                const hasCusto = m.custo > 0;
                return (
                  <div
                    key={vItem.key}
                    data-index={vItem.index}
                    ref={rowVirtualizer.measureElement}
                    role="row"
                    style={baseStyle}
                    className={cn(gridColsClass, "items-center border-b bg-muted/20 px-1 hover:bg-muted/40")}
                  >
                    {canModifyBaseDados && <div role="cell" />}
                    <div role="cell" />
                    <div role="cell" className="font-mono py-1.5 pl-6 border-l-2 border-primary/20 truncate">
                      {highlightMatch(m.bitola, search.debounced)}
                    </div>
                    <div role="cell" className="py-1.5 px-1">{m.unidade}</div>
                    <div role="cell" className="font-mono py-1.5 px-1">
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
                    </div>
                    <div role="cell" className="text-right font-mono py-1.5 px-1">
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
                    </div>
                    <div role="cell" className="text-sm text-muted-foreground py-1.5 px-1 truncate">
                      {(m as any).notas || "-"}
                    </div>
                    {canModifyBaseDados && (
                      <div role="cell" className="flex justify-end gap-1 py-1.5">
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
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

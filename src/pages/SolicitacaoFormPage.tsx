import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useMaterials,
  useProjects,
  useSolicitacao,
  useAddSolicitacao,
  useUpdateSolicitacao,
} from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ArrowLeft, Save, Upload, FileText, X, FileDown } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/formatCurrency";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface FormItem {
  key: string;
  material_id: string | null;
  descricao: string;
  bitola: string;
  erp_item: string;
  quantidade: number;
  unidade: string;
  custo_unitario: number;
  custo_total: number;
}

const emptyItem = (): FormItem => ({
  key: `item-${Date.now()}-${Math.random()}`,
  material_id: null,
  descricao: "",
  bitola: "",
  erp_item: "",
  quantidade: 1,
  unidade: "un",
  custo_unitario: 0,
  custo_total: 0,
});

export default function SolicitacaoFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const { data: materials = [] } = useMaterials();
  const { data: existing } = useSolicitacao(id);
  const addSolicitacao = useAddSolicitacao();
  const updateSolicitacao = useUpdateSolicitacao();

  const isNew = !id || id === "nova";
  const isReadOnly = !isNew && existing?.status !== "Aberta";

  const [projetoId, setProjetoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [dataSolicitacao, setDataSolicitacao] = useState(new Date().toISOString().split("T")[0]);
  const [revisao, setRevisao] = useState("");
  const [erp, setErp] = useState("");
  const [notas, setNotas] = useState("");
  const [status, setStatus] = useState("Aberta");
  const [desenho, setDesenho] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [itens, setItens] = useState<FormItem[]>([emptyItem()]);
  const [loaded, setLoaded] = useState(false);
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState("");
  const statusChanged = existing && status !== existing.status;

  useEffect(() => {
    if (existing && !loaded) {
      setProjetoId(existing.projeto_id);
      setMotivo(existing.motivo);
      setDataSolicitacao(existing.data_solicitacao);
      setRevisao(existing.revisao);
      setErp(existing.erp);
      setNotas(existing.notas);
      setStatus(existing.status);
      setDesenho(existing.desenho || null);
      setItens(
        (existing.solicitacao_itens || []).map((i: any) => {
          const mat = materials.find((m) => m.id === i.material_id);
          return {
            key: i.id,
            material_id: i.material_id,
            descricao: i.descricao,
            bitola: i.bitola,
            erp_item: mat?.erp || "",
            quantidade: i.quantidade,
            unidade: i.unidade,
            custo_unitario: i.custo_unitario,
            custo_total: i.custo_total,
          };
        }),
      );
      setLoaded(true);
    }
  }, [existing, loaded]);

  const descriptions = useMemo(() => [...new Set(materials.map((m) => m.descricao))].sort(), [materials]);

  const getBitolas = (desc: string) => {
    const bitolas = materials.filter((m) => m.descricao === desc).map((m) => m.bitola);
    return [...new Set(bitolas)];
  };

  const handleDescChange = (index: number, desc: string) => {
    setItens((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return { ...item, descricao: desc, bitola: "", custo_unitario: 0, custo_total: 0, material_id: null };
      }),
    );
  };

  const handleBitolaChange = (index: number, bitola: string) => {
    setItens((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const mat = materials.find((m) => m.descricao === item.descricao && m.bitola === bitola);
        const custo_unitario = mat?.custo || 0;
        const unidade = mat?.unidade || "un";
        const erp_item = mat?.erp || "";
        return {
          ...item,
          bitola,
          material_id: mat?.id || null,
          custo_unitario,
          unidade,
          erp_item,
          custo_total: item.quantidade * custo_unitario,
        };
      }),
    );
  };

  const handleQtdChange = (index: number, qty: number) => {
    setItens((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return { ...item, quantidade: qty, custo_total: qty * item.custo_unitario };
      }),
    );
  };

  const handleCustoChange = (index: number, custo: number) => {
    setItens((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return { ...item, custo_unitario: custo, custo_total: item.quantidade * custo };
      }),
    );
  };

  const addItem = () => setItens((prev) => [...prev, emptyItem()]);
  const removeItem = (index: number) => setItens((prev) => prev.filter((_, i) => i !== index));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF são permitidos");
      return;
    }
    setUploading(true);
    const fileName = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("desenhos").upload(fileName, file);
    if (error) {
      toast.error("Erro ao fazer upload do desenho");
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("desenhos").getPublicUrl(fileName);
    setDesenho(urlData.publicUrl);
    setUploading(false);
    toast.success("Desenho anexado");
  };

  const removeDesenho = () => {
    setDesenho(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Exportar Lista de Materiais como PDF ───────────────────────────────────
  const handleExportPDF = () => {
    const projeto = projects.find((p) => p.id === projetoId);
    const numeroSolicitacao = existing?.numero ?? "Nova";
    const dataFormatada = dataSolicitacao ? new Date(dataSolicitacao + "T00:00:00").toLocaleDateString("pt-BR") : "-";

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // ── Cabeçalho ──
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Lista de Materiais", margin, 18);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);

    let currentY = 26;

    const addInfoRow = (left: string, right: string) => {
      if (left) doc.text(left, margin, currentY);
      if (right) doc.text(right, pageWidth / 2, currentY);
      currentY += 5;
    };

    addInfoRow(
      `Solicitação: ${numeroSolicitacao}`,
      `Projeto: ${projeto ? `${projeto.numero} — ${projeto.descricao}` : "-"}`,
    );
    addInfoRow(`Motivo: ${motivo || "-"}`, `Status: ${status}`);
    addInfoRow(`Data: ${dataFormatada}`, revisao ? `Revisão: ${revisao}` : erp ? `ERP: ${erp}` : "");

    if (notas) {
      currentY += 1;
      doc.setFont("helvetica", "italic");
      const notasLines = doc.splitTextToSize(`Notas: ${notas}`, pageWidth - margin * 2);
      doc.text(notasLines, margin, currentY);
      currentY += notasLines.length * 4.5;
    }

    doc.setTextColor(0);
    currentY += 2;

    // ── Linha separadora ──
    doc.setDrawColor(200);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 4;

    // ── Tabela de itens ──
    const tableRows = itens.map((item, idx) => [
      String(idx + 1),
      item.descricao || "-",
      item.bitola || "-",
      item.erp_item || "-",
      String(item.quantidade),
      item.unidade,
      formatBRL(item.custo_unitario),
      formatBRL(item.custo_total),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["#", "Descrição", "Bitola", "ERP", "Qtd", "Un.", "Custo Unit.", "Custo Total"]],
      body: tableRows,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7.5,
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 22 },
        3: { cellWidth: 18 },
        4: { cellWidth: 12, halign: "center" },
        5: { cellWidth: 12, halign: "center" },
        6: { cellWidth: 26, halign: "right" },
        7: { cellWidth: 26, halign: "right" },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    // ── Total Geral ──
    const finalY = (doc as any).lastAutoTable.finalY + 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Total Geral:", pageWidth - margin - 52, finalY);
    doc.text(formatBRL(totalGeral), pageWidth - margin, finalY, { align: "right" });

    // ── Rodapé com paginação ──
    const pageCount = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Gerado em ${new Date().toLocaleString("pt-BR")} — Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 6,
        { align: "center" },
      );
    }

    const fileName = `lista-materiais-${numeroSolicitacao.replace(/\//g, "-")}.pdf`;
    doc.save(fileName);
    toast.success("PDF exportado com sucesso!");
  };
  // ────────────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!projetoId) {
      toast.error("Selecione um projeto");
      return;
    }
    if (!motivo.trim()) {
      toast.error("Informe o motivo");
      return;
    }
    if (motivo === "Material Faltante" && !notas.trim()) {
      toast.error("Descreva o motivo do material faltante no campo Notas");
      return;
    }
    if (itens.length === 0 || itens.some((i) => !i.descricao || !i.bitola)) {
      toast.error("Preencha todos os itens corretamente");
      return;
    }

    if (isNew && motivo === "Material Faltante") {
      const { data: existingSols } = await supabase
        .from("solicitacoes")
        .select("numero, solicitacao_itens(descricao, bitola)")
        .eq("projeto_id", projetoId)
        .neq("status", "Cancelada");

      if (existingSols && existingSols.length > 0) {
        const duplicates: { item: string; listas: string[] }[] = [];

        for (const item of itens) {
          const itemKey = `${item.descricao}||${item.bitola}`;
          const listasComItem: string[] = [];

          for (const sol of existingSols) {
            const solItens = (sol as any).solicitacao_itens || [];
            const found = solItens.some((si: any) => `${si.descricao}||${si.bitola}` === itemKey);
            if (found) listasComItem.push(sol.numero);
          }

          if (listasComItem.length > 0) {
            duplicates.push({ item: `${item.descricao} ${item.bitola}`, listas: listasComItem });
          }
        }

        if (duplicates.length > 0) {
          const msg = duplicates.map((d) => `${d.item} já solicitado em:\n${d.listas.join("\n")}`).join("\n\n");
          setDuplicateMessage(msg);
          setShowDuplicateAlert(true);
          return;
        }
      }
    }

    await doSave();
  };

  const doSave = async () => {
    const payload = {
      projeto_id: projetoId,
      motivo,
      data_solicitacao: dataSolicitacao,
      revisao,
      erp,
      notas,
      status,
      desenho,
      itens: itens.map(({ key, erp_item, ...rest }) => rest),
    };

    try {
      if (existing) {
        await updateSolicitacao.mutateAsync({ id: existing.id, ...payload });
        toast.success("Solicitação atualizada");
      } else {
        await addSolicitacao.mutateAsync(payload);
        toast.success("Solicitação criada");
      }
      navigate("/solicitacoes");
    } catch {
      toast.error("Erro ao salvar solicitação");
    }
  };

  const totalGeral = itens.reduce((a, i) => a + i.custo_total, 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/solicitacoes")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{existing ? `Solicitação ${existing.numero}` : "Nova Solicitação"}</h1>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>Projeto *</Label>
                <Select value={projetoId} onValueChange={setProjetoId} disabled={isReadOnly}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.numero} - {p.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Motivo *</Label>
                <Select value={motivo} onValueChange={setMotivo} disabled={isReadOnly}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Material de Lista">Material de Lista</SelectItem>
                    <SelectItem value="Material Faltante">Material Faltante</SelectItem>
                    <SelectItem value="Alteração de Projeto">Alteração de Projeto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data da Solicitação *</Label>
                <Input
                  type="date"
                  value={dataSolicitacao}
                  onChange={(e) => setDataSolicitacao(e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aberta">Aberta</SelectItem>
                    <SelectItem value="Aprovada">Aprovada</SelectItem>
                    <SelectItem value="Material Comprado">Material Comprado</SelectItem>
                    <SelectItem value="Material enviado para Obra">Material enviado para Obra</SelectItem>
                    <SelectItem value="Finalizada">Finalizada</SelectItem>
                    <SelectItem value="Cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!isNew && (
                <>
                  <div>
                    <Label>Revisão</Label>
                    <Input value={revisao} onChange={(e) => setRevisao(e.target.value)} disabled={isReadOnly} />
                  </div>
                  <div>
                    <Label>ERP</Label>
                    <Input value={erp} onChange={(e) => setErp(e.target.value)} disabled={isReadOnly} />
                  </div>
                </>
              )}
              <div className="md:col-span-2 lg:col-span-3">
                <Label>Notas{motivo === "Material Faltante" ? " *" : ""}</Label>
                <Textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={3}
                  disabled={isReadOnly}
                  placeholder={motivo === "Material Faltante" ? "Descreva o Motivo" : ""}
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <Label>Desenho de Referência (PDF)</Label>
                {desenho ? (
                  <div className="flex items-center gap-2 mt-1">
                    <a href={desenho} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-1" />
                        Ver Desenho
                      </Button>
                    </a>
                    {!isReadOnly && (
                      <Button variant="ghost" size="icon" onClick={removeDesenho}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="mt-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      {uploading ? "Enviando..." : "Anexar Desenho"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Itens da Solicitação</CardTitle>
              <div className="flex gap-2">
                {/* Botão Exportar PDF */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  disabled={itens.length === 0 || itens.every((i) => !i.descricao)}
                  title="Exportar lista de materiais em PDF (A4)"
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  Exportar PDF
                </Button>
                {!isReadOnly && (
                  <Button variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Item
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[250px]">Descrição *</TableHead>
                    <TableHead className="min-w-[150px]">Bitola *</TableHead>
                    <TableHead className="w-28">ERP</TableHead>
                    <TableHead className="w-24">Qtd *</TableHead>
                    <TableHead className="w-20">Unid.</TableHead>
                    <TableHead className="text-right w-32">Custo Unit.</TableHead>
                    <TableHead className="text-right">Custo Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((item, idx) => (
                    <TableRow key={item.key}>
                      <TableCell>
                        <Select
                          value={item.descricao}
                          onValueChange={(v) => handleDescChange(idx, v)}
                          disabled={isReadOnly}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {descriptions.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.bitola}
                          onValueChange={(v) => handleBitolaChange(idx, v)}
                          disabled={isReadOnly || !item.descricao}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Bitola..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getBitolas(item.descricao).map((b) => (
                              <SelectItem key={b} value={b}>
                                {b}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.erp_item}
                          onChange={(e) =>
                            setItens((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, erp_item: e.target.value } : it)),
                            )
                          }
                          disabled={isReadOnly}
                          placeholder="ERP"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantidade}
                          onChange={(e) => handleQtdChange(idx, Number(e.target.value))}
                          disabled={isReadOnly}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{item.unidade}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.custo_unitario}
                          onChange={(e) => handleCustoChange(idx, Number(e.target.value))}
                          disabled={isReadOnly}
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatBRL(item.custo_total)}</TableCell>
                      <TableCell>
                        {!isReadOnly && (
                          <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t">
              <div className="text-right">
                <span className="text-sm text-muted-foreground mr-3">Total Geral:</span>
                <span className="text-xl font-bold font-mono">{formatBRL(totalGeral)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate("/solicitacoes")}>
            Voltar
          </Button>
          <Button
            onClick={handleSave}
            disabled={(isReadOnly && !statusChanged) || addSolicitacao.isPending || updateSolicitacao.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar Solicitação
          </Button>
        </div>
      </div>

      <AlertDialog open={showDuplicateAlert} onOpenChange={setShowDuplicateAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Material já solicitado</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">{duplicateMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDuplicateAlert(false);
                doSave();
              }}
            >
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

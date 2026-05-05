import { useState, useMemo, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useNavigate, useParams } from 'react-router-dom';
import { useMaterials, useProjects, useSolicitacao, useAddSolicitacao, useUpdateSolicitacao } from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Plus, Trash2, ArrowLeft, Save, Upload, FileText, X, Download, Star, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import { formatBRL } from '@/lib/formatCurrency';
import { usePermissions } from '@/hooks/usePermissions';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { History, MessageSquare, FileText as FileTextIcon } from 'lucide-react';
import { AuditTimeline } from '@/components/solicitacoes/AuditTimeline';
import { CommentsPanel } from '@/components/solicitacoes/CommentsPanel';
import { DrawingsManager } from '@/components/solicitacoes/DrawingsManager';
import { useAuth } from '@/hooks/useAuth';
import { useSolicitacaoRealtime } from '@/hooks/useSolicitacaoRealtime';
import { useSolicitacaoComments } from '@/hooks/useSolicitacaoActivity';

interface FormItem {
  key: string;
  material_id: string | null;
  descricao: string;
  bitola: string;
  erp_item: string;
  notas: string;
  quantidade: number;
  unidade: string;
  custo_unitario: number;
  custo_total: number;
  isSpecial?: boolean;
}

const emptyItem = (): FormItem => ({
  key: `item-${Date.now()}-${Math.random()}`,
  material_id: null,
  descricao: '',
  bitola: '',
  erp_item: '',
  notas: '',
  quantidade: 1,
  unidade: 'un',
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

  const { canCreateSolicitacao, canEditSolicitacao, canChangeStatus, getAllowedStatuses } = usePermissions();
  const { user } = useAuth();
  useSolicitacaoRealtime(existing?.id, { currentUserId: user?.id });
  const { data: comments = [] } = useSolicitacaoComments(existing?.id);

  const isNew = !id || id === 'nova';
  const isReadOnly = isNew
    ? !canCreateSolicitacao
    : !canEditSolicitacao(existing?.status || 'Aberta');

  const [projetoId, setProjetoId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [dataSolicitacao, setDataSolicitacao] = useState(new Date().toISOString().split('T')[0]);
  const [revisao, setRevisao] = useState('');
  const [erp, setErp] = useState('');
  const [notas, setNotas] = useState('');
  const [status, setStatus] = useState('Aberta');
  const [desenho, setDesenho] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCostPdf, setExportingCostPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [initialItem] = useState<FormItem>(() => emptyItem());
  const [itens, setItens] = useState<FormItem[]>([initialItem]);
  const [editingKeys, setEditingKeys] = useState<Set<string>>(() => new Set([initialItem.key]));
  const [loaded, setLoaded] = useState(false);
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState('');
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
          const mat = materials.find(m => m.id === i.material_id);
          const isSpecial = !i.material_id;
          return {
            key: i.id,
            material_id: i.material_id,
            descricao: i.descricao,
            bitola: i.bitola,
            erp_item: mat?.erp || '',
            notas: i.notas || '',
            quantidade: i.quantidade,
            unidade: i.unidade,
            custo_unitario: i.custo_unitario,
            custo_total: i.custo_total,
            isSpecial,
          };
        })
      );
      setEditingKeys(new Set());
      setLoaded(true);
    }
  }, [existing, loaded]);

  const descriptions = useMemo(() => [...new Set(materials.map(m => m.descricao))].sort(), [materials]);

  const parseBitolaValue = (b: string): number => {
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
  };

  const getBitolas = (desc: string) => {
    const bitolas = materials.filter(m => m.descricao === desc).map(m => m.bitola);
    return [...new Set(bitolas)].sort((a, b) => parseBitolaValue(a) - parseBitolaValue(b));
  };

  const handleDescChange = (index: number, desc: string) => {
    setItens(prev => prev.map((item, i) => {
      if (i !== index) return item;
      return { ...item, descricao: desc, bitola: '', custo_unitario: 0, custo_total: 0, material_id: null };
    }));
  };

  const handleBitolaChange = (index: number, bitola: string) => {
    setItens(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const mat = materials.find(m => m.descricao === item.descricao && m.bitola === bitola);
      const custo_unitario = mat?.custo || 0;
      const unidade = mat?.unidade || 'un';
      const erp_item = mat?.erp || '';
      const notas = (mat as any)?.notas || '';
      return {
        ...item,
        bitola,
        material_id: mat?.id || null,
        custo_unitario,
        unidade,
        erp_item,
        notas,
        custo_total: item.quantidade * custo_unitario,
      };
    }));
  };

  const handleQtdChange = (index: number, qty: number) => {
    setItens(prev => prev.map((item, i) => {
      if (i !== index) return item;
      return { ...item, quantidade: qty, custo_total: qty * item.custo_unitario };
    }));
  };

  const handleCustoChange = (index: number, custo: number) => {
    setItens(prev => prev.map((item, i) => {
      if (i !== index) return item;
      return { ...item, custo_unitario: custo, custo_total: item.quantidade * custo };
    }));
  };

  const addItem = () => {
    const item = emptyItem();
    setItens(prev => [...prev, item]);
    setEditingKeys(prev => new Set(prev).add(item.key));
  };
  const addSpecialItem = () => {
    const item = { ...emptyItem(), isSpecial: true };
    setItens(prev => [...prev, item]);
    setEditingKeys(prev => new Set(prev).add(item.key));
  };
  const removeItem = (index: number) => {
    const removed = itens[index];
    setItens(prev => prev.filter((_, i) => i !== index));
    if (removed) {
      setEditingKeys(prev => {
        const next = new Set(prev);
        next.delete(removed.key);
        return next;
      });
    }
  };
  const toggleEditItem = (key: string) => {
    setEditingKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são permitidos');
      return;
    }
    setUploading(true);
    const fileName = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('desenhos').upload(fileName, file);
    if (error) {
      toast.error('Erro ao fazer upload do desenho');
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('desenhos').getPublicUrl(fileName);
    setDesenho(urlData.publicUrl);
    setUploading(false);
    toast.success('Desenho anexado');
  };

  const removeDesenho = () => {
    setDesenho(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Exportar PDF: A4 horizontal ──────────────────────────────────────────
  const handleExportPDF = () => {
    if (!existing) return;
    setExportingPdf(true);

    try {
      const projeto = projects.find(p => p.id === projetoId);
      const dataGeracao =
        new Date().toLocaleDateString('pt-BR') +
        ' às ' +
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });




      const doc = new jsPDF('l', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text('LDM TRADE', 14, 16);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Solicitação ${existing.numero}`, pageWidth - 14, 16, { align: 'right' });
      doc.setDrawColor(34, 34, 34);
      doc.setLineWidth(0.5);
      doc.line(14, 19, pageWidth - 14, 19);

      // Info section
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Informações Gerais', 14, 26);
      doc.setLineWidth(0.2);
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 27.5, pageWidth - 14, 27.5);

      doc.setFontSize(8.5);
      const infoLines: [string, string][] = [
        ['Projeto:', projeto ? `${projeto.numero} - ${projeto.descricao}` : '—'],
        ['Motivo:', motivo || '—'],
        ['Data da Solicitação:', dataSolicitacao || '—'],
        ['Status:', status || '—'],
      ];
      if (revisao) infoLines.push(['Revisão:', revisao]);
      if (erp) infoLines.push(['ERP:', erp]);
      if (notas) infoLines.push(['Notas:', notas]);

      let infoY = 32;
      infoLines.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, 14, infoY);
        doc.setFont('helvetica', 'normal');
        doc.text(value, 50, infoY);
        infoY += 5;
      });

      // Items table
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Itens da Solicitação', 14, infoY + 4);
      doc.setLineWidth(0.2);
      doc.line(14, infoY + 5.5, pageWidth - 14, infoY + 5.5);

      const tableData = itens.map((item, i) => [
        String(i + 1),
        item.descricao,
        item.bitola,
        item.erp_item || '',
        String(item.quantidade),
        item.unidade,
        item.notas || '',
      ]);

      autoTable(doc, {
        startY: infoY + 8,
        head: [['#', 'Descrição', 'Bitola', 'ERP', 'Qtd', 'Un.', 'Notas']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [34, 34, 34], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          2: { cellWidth: 22, overflow: 'hidden' },
          3: { cellWidth: 28, overflow: 'hidden' },
          4: { halign: 'center', cellWidth: 14, overflow: 'hidden' },
          5: { halign: 'center', cellWidth: 12, overflow: 'hidden' },
        },
        margin: { left: 14, right: 14 },
      });

      // Footer
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(136, 136, 136);
      doc.text(`Gerado em ${dataGeracao}`, 14, doc.internal.pageSize.getHeight() - 8);

      doc.save(`solicitacao-${existing.numero}.pdf`);
      setExportingPdf(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar PDF');
      setExportingPdf(false);
    }
  };
  // ─── Exportar XLSX ─────────────────────────────────────────────────────────
  const handleExportXLSX = () => {
    if (!existing) return;
    const projeto = projects.find(p => p.id === projetoId);
    const dataGeracao =
      new Date().toLocaleDateString('pt-BR') +
      ' às ' +
      new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const data: (string | number)[][] = [];

    // Header
    data.push(['LDM TRADE', '', '', '', '', '', `Solicitação ${existing.numero}`]);
    data.push([]);

    // Info section
    data.push(['Informações Gerais']);
    data.push(['Projeto:', projeto ? `${projeto.numero} - ${projeto.descricao}` : '—']);
    data.push(['Motivo:', motivo || '—']);
    data.push(['Data da Solicitação:', dataSolicitacao || '—']);
    data.push(['Status:', status || '—']);
    if (revisao) data.push(['Revisão:', revisao]);
    if (erp) data.push(['ERP:', erp]);
    if (notas) data.push(['Notas:', notas]);
    data.push([]);

    // Items table header
    data.push(['Itens da Solicitação']);
    data.push(['#', 'Descrição', 'Bitola', 'ERP', 'Qtd', 'Un.', 'Notas']);

    // Items rows
    itens.forEach((item, i) => {
      data.push([
        i + 1,
        item.descricao,
        item.bitola,
        item.erp_item || '',
        item.quantidade,
        item.unidade,
        item.notas || '',
      ]);
    });

    data.push([]);
    data.push([`Gerado em ${dataGeracao}`]);

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Column widths matching PDF proportions
    ws['!cols'] = [
      { wch: 6 },   // #
      { wch: 40 },  // Descrição
      { wch: 14 },  // Bitola
      { wch: 18 },  // ERP
      { wch: 10 },  // Qtd
      { wch: 8 },   // Un.
      { wch: 30 },  // Notas
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Solicitação');
    XLSX.writeFile(wb, `solicitacao-${existing.numero}.xlsx`);
  };
  // ──────────────────────────────────────────────────────────────────────────

  // ─── Exportar Relatório de Custos ─────────────────────────────────────────
  const handleExportCostPDF = () => {
    if (!existing) return;
    setExportingCostPdf(true);

    try {
      const projeto = projects.find(p => p.id === projetoId);
      const dataGeracao =
        new Date().toLocaleDateString('pt-BR') +
        ' às ' +
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const doc = new jsPDF('l', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text('LDM TRADE', 14, 16);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Relatório de Custos — Solicitação ${existing.numero}`, pageWidth - 14, 16, { align: 'right' });
      doc.setDrawColor(34, 34, 34);
      doc.setLineWidth(0.5);
      doc.line(14, 19, pageWidth - 14, 19);

      // Info section
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Informações Gerais', 14, 26);
      doc.setLineWidth(0.2);
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 27.5, pageWidth - 14, 27.5);

      doc.setFontSize(8.5);
      const infoLines: [string, string][] = [
        ['Projeto:', projeto ? `${projeto.numero} - ${projeto.descricao}` : '—'],
        ['Motivo:', motivo || '—'],
        ['Data da Solicitação:', dataSolicitacao || '—'],
        ['Status:', status || '—'],
      ];
      if (revisao) infoLines.push(['Revisão:', revisao]);
      if (erp) infoLines.push(['ERP:', erp]);

      let infoY = 32;
      infoLines.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, 14, infoY);
        doc.setFont('helvetica', 'normal');
        doc.text(value, 50, infoY);
        infoY += 5;
      });

      // Build rows with costs from materials DB (or stored custo_unitario for special items)
      let totalGeral = 0;
      const tableData = itens.map((item, i) => {
        const mat = item.material_id ? materials.find(m => m.id === item.material_id) : null;
        const custoUnit = mat ? (mat.custo ?? 0) : (item.custo_unitario ?? 0);
        const custoTotal = item.quantidade * custoUnit;
        totalGeral += custoTotal;
        return [
          String(i + 1),
          item.descricao,
          item.bitola,
          item.erp_item || '',
          String(item.quantidade),
          item.unidade,
          formatBRL(custoUnit),
          formatBRL(custoTotal),
        ];
      });

      // Items table
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Itens da Solicitação', 14, infoY + 4);
      doc.setLineWidth(0.2);
      doc.line(14, infoY + 5.5, pageWidth - 14, infoY + 5.5);

      autoTable(doc, {
        startY: infoY + 8,
        head: [['#', 'Descrição', 'Bitola', 'ERP', 'Qtd', 'Un.', 'Custo Unit.', 'Custo Total']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [34, 34, 34], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          2: { cellWidth: 22 },
          3: { cellWidth: 28 },
          4: { halign: 'center', cellWidth: 14 },
          5: { halign: 'center', cellWidth: 12 },
          6: { halign: 'right', cellWidth: 32 },
          7: { halign: 'right', cellWidth: 32 },
        },
        margin: { left: 14, right: 14 },
      });

      // Total Geral
      const finalY = (doc as any).lastAutoTable.finalY + 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 34, 34);
      doc.text('Total Geral:', pageWidth - 14 - 60, finalY);
      doc.text(formatBRL(totalGeral), pageWidth - 14, finalY, { align: 'right' });

      // Footer
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(136, 136, 136);
      doc.text(`Gerado em ${dataGeracao}`, 14, doc.internal.pageSize.getHeight() - 8);

      doc.save(`relatorio-custos-${existing.numero}.pdf`);
      setExportingCostPdf(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar relatório de custos');
      setExportingCostPdf(false);
    }
  };
  // ──────────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!projetoId) { toast.error('Selecione um projeto'); return; }
    if (!motivo.trim()) { toast.error('Informe o motivo'); return; }
    if (motivo === 'Material Faltante' && !notas.trim()) {
      toast.error('Descreva o motivo do material faltante no campo Notas');
      return;
    }
    if (itens.length === 0 || itens.some(i => !i.descricao || (!i.isSpecial && !i.bitola))) {
      toast.error('Preencha todos os itens corretamente');
      return;
    }

    if (isNew && motivo === 'Material Faltante') {
      const { data: existingSols } = await supabase
        .from('solicitacoes')
        .select('numero, solicitacao_itens(descricao, bitola)')
        .eq('projeto_id', projetoId)
        .neq('status', 'Cancelada');

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
          const msg = duplicates
            .map(d => `${d.item} já solicitado em:\n${d.listas.join('\n')}`)
            .join('\n\n');
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
      itens: itens.map(({ key, erp_item, isSpecial, ...rest }) => rest),
    };

    try {
      if (existing) {
        await updateSolicitacao.mutateAsync({ id: existing.id, ...payload });
        toast.success('Solicitação atualizada');
      } else {
        await addSolicitacao.mutateAsync(payload);
        toast.success('Solicitação criada');
      }
      navigate('/solicitacoes');
    } catch {
      toast.error('Erro ao salvar solicitação');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" aria-label="Voltar para Solicitações" onClick={() => navigate('/solicitacoes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">
          {existing ? `Solicitação ${existing.numero}` : 'Nova Solicitação'}
        </h1>
        {existing && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={handleExportXLSX}>
              <Download className="h-4 w-4 mr-2" />
              Exportar XLSX
            </Button>
            <Button variant="outline" onClick={handleExportCostPDF} disabled={exportingCostPdf}>
              <Download className="h-4 w-4 mr-2" />
              {exportingCostPdf ? 'Gerando...' : 'Relatório de Custos'}
            </Button>
            <Button variant="outline" onClick={handleExportPDF} disabled={exportingPdf}>
              <Download className="h-4 w-4 mr-2" />
              {exportingPdf ? 'Gerando PDF...' : 'Exportar PDF'}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Informações Gerais</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>Projeto *</Label>
                <Select value={projetoId} onValueChange={setProjetoId} disabled={isReadOnly}>
                  <SelectTrigger><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.numero} - {p.descricao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Motivo *</Label>
                <Select value={motivo} onValueChange={setMotivo} disabled={isReadOnly}>
                  <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
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
                  onChange={e => setDataSolicitacao(e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label>Status</Label>
                {(() => {
                  const currentStatus = existing?.status || 'Aberta';
                  const allowedStatuses = getAllowedStatuses(currentStatus);
                  const statusDisabled = isNew || (!canChangeStatus && !isNew) || allowedStatuses.length <= 1;
                  return (
                    <Select value={status} onValueChange={setStatus} disabled={statusDisabled}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {allowedStatuses.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })()}
              </div>
              {!isNew && (
                <div>
                  <Label>Revisão</Label>
                  <Input value={revisao} onChange={e => setRevisao(e.target.value)} disabled={isReadOnly} />
                </div>
              )}
              <div className="md:col-span-2 lg:col-span-3">
                <Label>Notas{motivo === 'Material Faltante' ? ' *' : ''}</Label>
                <Textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  rows={3}
                  disabled={isReadOnly}
                  placeholder={motivo === 'Material Faltante' ? 'Descreva o Motivo' : ''}
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <Label>Desenho de Referência (PDF)</Label>
                {desenho ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Button variant="outline" size="sm" asChild>
                      <a href={desenho} target="_blank" rel="noopener noreferrer">
                        <FileText className="h-4 w-4 mr-1" />Ver Desenho
                      </a>
                    </Button>
                    {!isReadOnly && (
                      <Button variant="ghost" size="icon" aria-label="Remover desenho" onClick={removeDesenho}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ) : !isReadOnly ? (
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
                      <Upload className="h-4 w-4 mr-1" />{uploading ? 'Enviando...' : 'Anexar Desenho'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">Nenhum desenho anexado</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Itens da Solicitação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {itens.map((item, idx) => {
                const isEditing = editingKeys.has(item.key);
                const itemDisabled = isReadOnly || !isEditing;
                return (
                  <div
                    key={item.key}
                    className="rounded-lg border bg-card/40 p-3 sm:p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          Item {idx + 1}
                        </span>
                        {item.isSpecial && (
                          <Badge variant="secondary" className="gap-1">
                            <Star className="h-3 w-3" />
                            Especial
                          </Badge>
                        )}
                      </div>
                      {!isReadOnly && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={isEditing ? 'Concluir edição do item' : 'Editar item'}
                            onClick={() => toggleEditItem(item.key)}
                            title={isEditing ? 'Concluir edição' : 'Editar item'}
                          >
                            {isEditing ? (
                              <Check className="h-4 w-4 text-primary" />
                            ) : (
                              <Pencil className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Remover item"
                            onClick={() => removeItem(idx)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-6 lg:grid-cols-12 gap-3">
                      <div className="col-span-2 sm:col-span-6 lg:col-span-5">
                        <Label className="text-xs font-medium text-foreground/80">
                          Descrição *
                        </Label>
                        {item.isSpecial ? (
                          <Input
                            value={item.descricao}
                            onChange={e => setItens(prev => prev.map((it, i) => i === idx ? { ...it, descricao: e.target.value } : it))}
                            disabled={itemDisabled}
                            placeholder="Descrição livre"
                          />
                        ) : (
                          <SearchableSelect
                            options={descriptions}
                            value={item.descricao}
                            onValueChange={v => handleDescChange(idx, v)}
                            disabled={itemDisabled}
                            placeholder="Selecione"
                            searchPlaceholder="Buscar material..."
                            emptyMessage="Nenhum material encontrado."
                          />
                        )}
                      </div>

                      <div className="col-span-2 sm:col-span-3 lg:col-span-3">
                        <Label className="text-xs font-medium text-foreground/80">
                          Bitola *
                        </Label>
                        {item.isSpecial ? (
                          <Input
                            value={item.bitola}
                            onChange={e => setItens(prev => prev.map((it, i) => i === idx ? { ...it, bitola: e.target.value } : it))}
                            disabled={itemDisabled}
                            placeholder="Bitola (opcional)"
                          />
                        ) : (
                          <SearchableSelect
                            options={getBitolas(item.descricao)}
                            value={item.bitola}
                            onValueChange={v => handleBitolaChange(idx, v)}
                            disabled={itemDisabled || !item.descricao}
                            placeholder="Bitola"
                            searchPlaceholder="Buscar bitola..."
                            emptyMessage="Nenhuma bitola encontrada."
                          />
                        )}
                      </div>

                      <div className="col-span-1 sm:col-span-3 lg:col-span-2">
                        <Label className="text-xs font-medium text-foreground/80">
                          ERP
                        </Label>
                        <Input value={item.erp_item} disabled className="text-sm" />
                      </div>

                      <div className="col-span-1 sm:col-span-2 lg:col-span-1">
                        <Label className="text-xs font-medium text-foreground/80">
                          Qtd *
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={item.quantidade}
                          onChange={e => handleQtdChange(idx, parseFloat(e.target.value) || 0)}
                          disabled={itemDisabled}
                        />
                      </div>

                      <div className="col-span-1 sm:col-span-2 lg:col-span-1">
                        <Label className="text-xs font-medium text-foreground/80">
                          Unid.
                        </Label>
                        {item.isSpecial ? (
                          <Input
                            value={item.unidade}
                            onChange={e => setItens(prev => prev.map((it, i) => i === idx ? { ...it, unidade: e.target.value } : it))}
                            disabled={itemDisabled}
                          />
                        ) : (
                          <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/40 text-sm">
                            {item.unidade}
                          </div>
                        )}
                      </div>

                      <div className="col-span-2 sm:col-span-2 lg:col-span-3">
                        <Label className="text-xs font-medium text-foreground/80">
                          Custo Unit.
                        </Label>
                        {item.isSpecial ? (
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.custo_unitario}
                            onChange={e => handleCustoChange(idx, parseFloat(e.target.value) || 0)}
                            disabled={itemDisabled}
                            placeholder="0,00"
                          />
                        ) : (
                          <div className="h-10 flex items-center justify-end px-3 rounded-md border border-input bg-muted/40 text-sm font-medium tabular-nums">
                            {formatBRL(item.custo_unitario)}
                          </div>
                        )}
                      </div>

                      <div className="col-span-2 sm:col-span-6 lg:col-span-12">
                        <Label className="text-xs font-medium text-foreground/80">
                          Notas
                        </Label>
                        {item.isSpecial ? (
                          <Input
                            value={item.notas}
                            onChange={e => setItens(prev => prev.map((it, i) => i === idx ? { ...it, notas: e.target.value } : it))}
                            disabled={itemDisabled}
                            placeholder="Observações"
                          />
                        ) : (
                          <div className="min-h-10 flex items-center px-3 rounded-md border border-input bg-muted/40 text-sm text-foreground/80">
                            {item.notas || '—'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {!isReadOnly && (
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />Adicionar Item
                </Button>
                <Button variant="outline" size="sm" onClick={addSpecialItem}>
                  <Star className="h-4 w-4 mr-1" />Item Especial
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {existing?.id && (
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="historico">
                <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
                  <TabsTrigger value="historico" className="gap-1.5">
                    <History className="h-4 w-4" />
                    <span>Histórico</span>
                  </TabsTrigger>
                  <TabsTrigger value="comentarios" className="gap-1.5">
                    <MessageSquare className="h-4 w-4" />
                    <span>Comentários{comments.length > 0 ? ` (${comments.length})` : ''}</span>
                  </TabsTrigger>
                  <TabsTrigger value="desenhos" className="gap-1.5">
                    <FileTextIcon className="h-4 w-4" />
                    <span>Desenhos</span>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="historico" className="mt-4">
                  <AuditTimeline solicitacaoId={existing.id} />
                </TabsContent>
                <TabsContent value="comentarios" className="mt-4">
                  <CommentsPanel solicitacaoId={existing.id} />
                </TabsContent>
                <TabsContent value="desenhos" className="mt-4">
                  <DrawingsManager
                    solicitacaoId={existing.id}
                    legacyDesenho={existing.desenho ?? null}
                    isReadOnly={isReadOnly}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/solicitacoes')}>Voltar</Button>
          <Button
            onClick={handleSave}
            disabled={
              (isNew && !canCreateSolicitacao) ||
              (!isNew && isReadOnly && !statusChanged) ||
              (!isNew && statusChanged && !canChangeStatus) ||
              addSolicitacao.isPending ||
              updateSolicitacao.isPending
            }
          >
            <Save className="h-4 w-4 mr-2" />Salvar Solicitação
          </Button>
        </div>
      </div>

      <AlertDialog open={showDuplicateAlert} onOpenChange={setShowDuplicateAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Material já solicitado</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {duplicateMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowDuplicateAlert(false); doSave(); }}>
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

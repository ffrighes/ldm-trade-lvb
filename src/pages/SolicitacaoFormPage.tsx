import { useState, useMemo, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNavigate, useParams } from 'react-router-dom';
import { useMaterials, useProjects, useSolicitacao, useAddSolicitacao, useUpdateSolicitacao } from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, ArrowLeft, Save, Upload, FileText, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { formatBRL } from '@/lib/formatCurrency';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

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
  descricao: '',
  bitola: '',
  erp_item: '',
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

  const isNew = !id || id === 'nova';
  const isReadOnly = !isNew && existing?.status !== 'Aberta';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [itens, setItens] = useState<FormItem[]>([emptyItem()]);
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
          return {
            key: i.id,
            material_id: i.material_id,
            descricao: i.descricao,
            bitola: i.bitola,
            erp_item: mat?.erp || '',
            quantidade: i.quantidade,
            unidade: i.unidade,
            custo_unitario: i.custo_unitario,
            custo_total: i.custo_total,
          };
        })
      );
      setLoaded(true);
    }
  }, [existing, loaded]);

  const descriptions = useMemo(() => [...new Set(materials.map(m => m.descricao))].sort(), [materials]);

  const getBitolas = (desc: string) => {
    const bitolas = materials.filter(m => m.descricao === desc).map(m => m.bitola);
    return [...new Set(bitolas)];
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
      return {
        ...item,
        bitola,
        material_id: mat?.id || null,
        custo_unitario,
        unidade,
        erp_item,
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

  const addItem = () => setItens(prev => [...prev, emptyItem()]);
  const removeItem = (index: number) => setItens(prev => prev.filter((_, i) => i !== index));

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

  // ─── Exportar PDF: A4 vertical, sem dependências externas ─────────────────
  const handleExportPDF = () => {
    if (!existing) return;
    setExportingPdf(true);

    try {
      const projeto = projects.find(p => p.id === projetoId);
      const dataGeracao =
        new Date().toLocaleDateString('pt-BR') +
        ' às ' +
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const itensRows = itens
        .map(
          (item, idx) => `
        <tr class="${idx % 2 === 0 ? 'even' : ''}">
          <td class="center">${idx + 1}</td>
          <td>${item.descricao || '—'}</td>
          <td>${item.bitola || '—'}</td>
          <td>${item.erp_item || '—'}</td>
          <td class="center">${item.quantidade}</td>
          <td class="center">${item.unidade}</td>
          <td class="right">${formatBRL(item.custo_unitario)}</td>
          <td class="right">${formatBRL(item.custo_total)}</td>
        </tr>`
        )
        .join('');

      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Solicitacao ${existing.numero}</title>
  <style>
    @page { size: A4 portrait; margin: 16mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9pt; color: #111; }
    .header { display: flex; justify-content: space-between; align-items: flex-end;
              border-bottom: 2px solid #222; padding-bottom: 6px; margin-bottom: 10px; }
    .header .brand { font-size: 15pt; font-weight: bold; letter-spacing: 1px; }
    .header .numero { font-size: 11pt; color: #444; }
    .section-title { font-size: 10pt; font-weight: bold; margin: 10px 0 5px;
                     border-bottom: 1px solid #ccc; padding-bottom: 2px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 16px; margin-bottom: 4px; }
    .info-row { display: flex; gap: 4px; font-size: 8.5pt; }
    .info-label { font-weight: bold; white-space: nowrap; min-width: 110px; }
    .info-value { color: #333; }
    .info-full { grid-column: 1 / -1; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 8pt; }
    thead tr { background: #222; color: #fff; }
    thead th { padding: 5px 4px; font-weight: bold; }
    tbody tr.even { background: #f5f5f5; }
    tbody td { padding: 4px; border-bottom: 1px solid #e0e0e0; vertical-align: middle; }
    .center { text-align: center; }
    .right  { text-align: right; }
    .total-row { margin-top: 8px; text-align: right; font-size: 10pt; font-weight: bold; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0;
              font-size: 7pt; color: #888; border-top: 1px solid #ddd; padding-top: 3px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">LDM TRADE</div>
    <div class="numero">Solicitacao ${existing.numero}</div>
  </div>

  <div class="section-title">Informacoes Gerais</div>
  <div class="info-grid">
    <div class="info-row">
      <span class="info-label">Projeto:</span>
      <span class="info-value">${projeto ? projeto.numero + ' - ' + projeto.descricao : '—'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Motivo:</span>
      <span class="info-value">${motivo || '—'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Data da Solicitacao:</span>
      <span class="info-value">${dataSolicitacao || '—'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Status:</span>
      <span class="info-value">${status || '—'}</span>
    </div>
    ${revisao ? '<div class="info-row"><span class="info-label">Revisao:</span><span class="info-value">' + revisao + '</span></div>' : ''}
    ${erp ? '<div class="info-row"><span class="info-label">ERP:</span><span class="info-value">' + erp + '</span></div>' : ''}
    ${notas ? '<div class="info-row info-full"><span class="info-label">Notas:</span><span class="info-value">' + notas + '</span></div>' : ''}
  </div>

  <div class="section-title">Itens da Solicitacao</div>
  <table>
    <thead>
      <tr>
        <th class="center" style="width:22px">#</th>
        <th style="width:28%">Descricao</th>
        <th style="width:14%">Bitola</th>
        <th style="width:10%">ERP</th>
        <th class="center" style="width:7%">Qtd</th>
        <th class="center" style="width:6%">Un.</th>
        <th class="right" style="width:13%">Custo Unit.</th>
        <th class="right" style="width:13%">Custo Total</th>
      </tr>
    </thead>
    <tbody>${itensRows}</tbody>
  </table>

  <div class="total-row">Total Geral: ${formatBRL(totalGeral)}</div>

  <div class="footer">Gerado em ${dataGeracao}</div>
</body>
</html>`;

      // Abre em nova aba e dispara print automaticamente (salvar como PDF)
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const win = window.open(url, '_blank');
      if (win) {
        win.onload = () => {
          setTimeout(() => {
            win.print();
            URL.revokeObjectURL(url);
            setExportingPdf(false);
          }, 500);
        };
      } else {
        // fallback: link de download do HTML caso popup seja bloqueado
        const a = document.createElement('a');
        a.href = url;
        a.download = `solicitacao-${existing.numero}.html`;
        a.click();
        URL.revokeObjectURL(url);
        toast.info('Popup bloqueado. Arquivo HTML baixado — abra e imprima como PDF.');
        setExportingPdf(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar PDF');
      setExportingPdf(false);
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
    if (itens.length === 0 || itens.some(i => !i.descricao || !i.bitola)) {
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
      itens: itens.map(({ key, erp_item, ...rest }) => rest),
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

  const totalGeral = itens.reduce((a, i) => a + i.custo_total, 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/solicitacoes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">
          {existing ? `Solicitação ${existing.numero}` : 'Nova Solicitação'}
        </h1>
        {existing && (
          <div className="ml-auto">
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
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                    <Input value={revisao} onChange={e => setRevisao(e.target.value)} disabled={isReadOnly} />
                  </div>
                  <div>
                    <Label>ERP</Label>
                    <Input value={erp} onChange={e => setErp(e.target.value)} disabled={isReadOnly} />
                  </div>
                </>
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
                      <Button variant="ghost" size="icon" onClick={removeDesenho}>
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
            <div className="flex items-center justify-between">
              <CardTitle>Itens da Solicitação</CardTitle>
              {!isReadOnly && (
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />Adicionar Item
                </Button>
              )}
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
                          onValueChange={v => handleDescChange(idx, v)}
                          disabled={isReadOnly}
                        >
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {descriptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.bitola}
                          onValueChange={v => handleBitolaChange(idx, v)}
                          disabled={isReadOnly || !item.descricao}
                        >
                          <SelectTrigger><SelectValue placeholder="Bitola" /></SelectTrigger>
                          <SelectContent>
                            {getBitolas(item.descricao).map(b => (
                              <SelectItem key={b} value={b}>{b}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input value={item.erp_item} disabled className="w-24 text-xs" />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={item.quantidade}
                          onChange={e => handleQtdChange(idx, parseFloat(e.target.value) || 0)}
                          disabled={isReadOnly}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell className="text-center text-sm">{item.unidade}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.custo_unitario}
                          onChange={e => handleCustoChange(idx, parseFloat(e.target.value) || 0)}
                          disabled={isReadOnly}
                          className="w-28 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatBRL(item.custo_total)}
                      </TableCell>
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
          <Button variant="outline" onClick={() => navigate('/solicitacoes')}>Voltar</Button>
          <Button
            onClick={handleSave}
            disabled={
              (isReadOnly && !statusChanged) ||
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

import { useState, useMemo, useEffect, useRef } from 'react';
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
import { Plus, Trash2, ArrowLeft, Save, Upload, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatBRL } from '@/lib/formatCurrency';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';

interface FormItem {
  key: string;
  material_id: string | null;
  descricao: string;
  bitola: string;
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
  const perms = usePermissions();
  const { role } = useAuth();

  const isNew = !id || id === 'nova';
  // Determine read-only based on role permissions
  const canEditFields = isNew
    ? perms?.canCreateSolicitacao
    : perms?.canEditSolicitacao && existing?.status === 'Aberta';
  const isReadOnly = !canEditFields;

  const [projetoId, setProjetoId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [dataSolicitacao, setDataSolicitacao] = useState(new Date().toISOString().split('T')[0]);
  const [revisao, setRevisao] = useState('');
  const [erp, setErp] = useState('');
  const [notas, setNotas] = useState('');
  const [status, setStatus] = useState('Aberta');
  const [desenho, setDesenho] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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
        (existing.solicitacao_itens || []).map((i: any) => ({
          key: i.id,
          material_id: i.material_id,
          descricao: i.descricao,
          bitola: i.bitola,
          quantidade: i.quantidade,
          unidade: i.unidade,
          custo_unitario: i.custo_unitario,
          custo_total: i.custo_total,
        }))
      );
      setLoaded(true);
    }
  }, [existing, loaded]);

  const ALL_STATUSES = ['Aberta', 'Aprovada', 'Material Comprado', 'Material enviado para Obra', 'Finalizada', 'Cancelada'];

  const canChangeStatus = () => {
    if (!perms) return false;
    if (perms.canChangeAnyStatus) return true;
    if (perms.canChangeStatusTo.length > 0) return true;
    if (role === 'coordenador_campo' && existing?.status === 'Aberta') return true;
    return false;
  };

  const getAvailableStatuses = () => {
    if (!perms) return [status];
    if (perms.canChangeAnyStatus) return ALL_STATUSES;
    const available = new Set([status]);
    // Comprador: from Aprovada to specific statuses
    if (role === 'comprador' && existing?.status === 'Aprovada') {
      perms.canChangeStatusTo.forEach(s => available.add(s));
    }
    // Coordenador: can cancel open
    if (role === 'coordenador_campo' && existing?.status === 'Aberta') {
      available.add('Cancelada');
    }
    return ALL_STATUSES.filter(s => available.has(s));
  };

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
      return {
        ...item,
        bitola,
        material_id: mat?.id || null,
        custo_unitario,
        unidade,
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

    // Check for duplicate materials in other solicitations for the same project
    if (isNew && motivo === 'Material Faltante') {
      const { data: existingSols } = await supabase
        .from('solicitacoes')
        .select('numero, solicitacao_itens(descricao, bitola)')
        .eq('projeto_id', projetoId)
        .neq('status', 'Cancelada');

      if (existingSols && existingSols.length > 0) {
        const currentMaterials = itens.map(i => `${i.descricao}||${i.bitola}`);
        const matches: string[] = [];

        for (const sol of existingSols) {
          const solItens = (sol as any).solicitacao_itens || [];
          const found = solItens.filter((si: any) =>
            currentMaterials.includes(`${si.descricao}||${si.bitola}`)
          );
          if (found.length > 0) {
            const descs = found.map((f: any) => `${f.descricao} ${f.bitola}`).join(', ');
            matches.push(`${sol.numero}: ${descs}`);
          }
        }

        if (matches.length > 0) {
          setDuplicateMessage(
            `O material solicitado já foi comprado nas listas [${matches.join('; ')}]. Tem certeza que deseja solicitar?`
          );
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
      itens: itens.map(({ key, ...rest }) => rest),
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
        <Button variant="ghost" size="icon" onClick={() => navigate('/solicitacoes')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-bold">{existing ? `Solicitação ${existing.numero}` : 'Nova Solicitação'}</h1>
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
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.numero} - {p.descricao}</SelectItem>)}
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
                <Input type="date" value={dataSolicitacao} onChange={e => setDataSolicitacao(e.target.value)} disabled={isReadOnly} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus} disabled={!canChangeStatus()}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getAvailableStatuses().map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
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
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
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
              {!isReadOnly && <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" />Adicionar Item</Button>}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[250px]">Descrição *</TableHead>
                    <TableHead className="min-w-[150px]">Bitola *</TableHead>
                    <TableHead className="w-24">Qtd *</TableHead>
                    <TableHead className="w-20">Unid.</TableHead>
                    <TableHead className="text-right">Custo Unit.</TableHead>
                    <TableHead className="text-right">Custo Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((item, idx) => (
                    <TableRow key={item.key}>
                      <TableCell>
                        <Select value={item.descricao} onValueChange={v => handleDescChange(idx, v)} disabled={isReadOnly}>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            {descriptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={item.bitola} onValueChange={v => handleBitolaChange(idx, v)} disabled={isReadOnly || !item.descricao}>
                          <SelectTrigger><SelectValue placeholder="Bitola" /></SelectTrigger>
                          <SelectContent>
                            {getBitolas(item.descricao).map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={1} value={item.quantidade} onChange={e => handleQtdChange(idx, parseInt(e.target.value) || 0)} disabled={isReadOnly} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.unidade}</TableCell>
                      <TableCell className="text-right font-mono">{formatBRL(item.custo_unitario)}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatBRL(item.custo_total)}</TableCell>
                      <TableCell>
                        {!isReadOnly && itens.length > 1 && (
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
          <Button onClick={handleSave} disabled={(isReadOnly && !statusChanged) || addSolicitacao.isPending || updateSolicitacao.isPending}>
            <Save className="h-4 w-4 mr-2" />Salvar Solicitação
          </Button>
        </div>
      </div>

      <AlertDialog open={showDuplicateAlert} onOpenChange={setShowDuplicateAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Material já solicitado</AlertDialogTitle>
            <AlertDialogDescription>{duplicateMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowDuplicateAlert(false); doSave(); }}>Sim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

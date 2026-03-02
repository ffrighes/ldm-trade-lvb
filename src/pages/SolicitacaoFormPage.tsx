import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMaterials, useProjects, useSolicitacao, useAddSolicitacao, useUpdateSolicitacao } from '@/hooks/useSupabaseData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { formatBRL } from '@/lib/formatCurrency';

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

  const isNew = !id || id === 'nova';
  const isReadOnly = !isNew && existing?.status !== 'Aberta';

  const [projetoId, setProjetoId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [dataSolicitacao, setDataSolicitacao] = useState(new Date().toISOString().split('T')[0]);
  const [revisao, setRevisao] = useState('');
  const [erp, setErp] = useState('');
  const [notas, setNotas] = useState('');
  const [status, setStatus] = useState('Aberta');
  const [itens, setItens] = useState<FormItem[]>([emptyItem()]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (existing && !loaded) {
      setProjetoId(existing.projeto_id);
      setMotivo(existing.motivo);
      setDataSolicitacao(existing.data_solicitacao);
      setRevisao(existing.revisao);
      setErp(existing.erp);
      setNotas(existing.notas);
      setStatus(existing.status);
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

  const handleSave = async () => {
    if (!projetoId) { toast.error('Selecione um projeto'); return; }
    if (!motivo.trim()) { toast.error('Informe o motivo'); return; }
    if (itens.length === 0 || itens.some(i => !i.descricao || !i.bitola)) {
      toast.error('Preencha todos os itens corretamente');
      return;
    }

    const payload = {
      projeto_id: projetoId,
      motivo,
      data_solicitacao: dataSolicitacao,
      revisao,
      erp,
      notas,
      status,
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
                <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo da solicitação" disabled={isReadOnly} />
              </div>
              <div>
                <Label>Data da Solicitação *</Label>
                <Input type="date" value={dataSolicitacao} onChange={e => setDataSolicitacao(e.target.value)} disabled={isReadOnly} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus} disabled={isReadOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aberta">Aberta</SelectItem>
                    <SelectItem value="Aprovada">Aprovada</SelectItem>
                    <SelectItem value="Material Comprado">Material Comprado</SelectItem>
                    <SelectItem value="Material enviado para Obra">Material enviado para Obra</SelectItem>
                    <SelectItem value="Finalizada">Finalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Revisão</Label>
                <Input value={revisao} onChange={e => setRevisao(e.target.value)} disabled={isReadOnly} />
              </div>
              <div>
                <Label>ERP</Label>
                <Input value={erp} onChange={e => setErp(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <Label>Notas</Label>
                <Textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3} disabled={isReadOnly} />
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
          <Button onClick={handleSave} disabled={isReadOnly || addSolicitacao.isPending || updateSolicitacao.isPending}>
            <Save className="h-4 w-4 mr-2" />Salvar Solicitação
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { SolicitacaoItem, SolicitacaoStatus } from '@/types';
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

const emptyItem = (): SolicitacaoItem => ({
  id: `item-${Date.now()}-${Math.random()}`,
  materialId: '',
  descricao: '',
  bitola: '',
  quantidade: 1,
  unidade: 'un',
  custoUnitario: 0,
  custoTotal: 0,
});

export default function SolicitacaoFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { projects, materials, solicitacoes, addSolicitacao, updateSolicitacao } = useAppStore();

  const existing = id && id !== 'nova' ? solicitacoes.find(s => s.id === id) : null;

  const [projetoId, setProjetoId] = useState(existing?.projetoId || '');
  const [motivo, setMotivo] = useState(existing?.motivo || '');
  const [dataSolicitacao, setDataSolicitacao] = useState(existing?.dataSolicitacao || new Date().toISOString().split('T')[0]);
  const [revisao, setRevisao] = useState(existing?.revisao || '');
  const [erp, setErp] = useState(existing?.erp || '');
  const [notas, setNotas] = useState(existing?.notas || '');
  const [status, setStatus] = useState<SolicitacaoStatus>(existing?.status || 'Aberta');
  const [itens, setItens] = useState<SolicitacaoItem[]>(existing?.itens || [emptyItem()]);

  const descriptions = useMemo(() => [...new Set(materials.map(m => m.descricao))].sort(), [materials]);

  const getBitolas = (desc: string) => {
    const bitolas = materials.filter(m => m.descricao === desc).map(m => m.bitola);
    return [...new Set(bitolas)];
  };

  const handleDescChange = (index: number, desc: string) => {
    setItens(prev => prev.map((item, i) => {
      if (i !== index) return item;
      return { ...item, descricao: desc, bitola: '', custoUnitario: 0, custoTotal: 0 };
    }));
  };

  const handleBitolaChange = (index: number, bitola: string) => {
    setItens(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const mat = materials.find(m => m.descricao === item.descricao && m.bitola === bitola);
      const custoUnitario = mat?.custo || 0;
      const unidade = mat?.unidade || 'un';
      return {
        ...item,
        bitola,
        materialId: mat?.id || '',
        custoUnitario,
        unidade,
        custoTotal: item.quantidade * custoUnitario,
      };
    }));
  };

  const handleQtdChange = (index: number, qty: number) => {
    setItens(prev => prev.map((item, i) => {
      if (i !== index) return item;
      return { ...item, quantidade: qty, custoTotal: qty * item.custoUnitario };
    }));
  };

  const addItem = () => setItens(prev => [...prev, emptyItem()]);
  const removeItem = (index: number) => setItens(prev => prev.filter((_, i) => i !== index));

  const handleSave = () => {
    if (!projetoId) { toast.error('Selecione um projeto'); return; }
    if (!motivo.trim()) { toast.error('Informe o motivo'); return; }
    if (itens.length === 0 || itens.some(i => !i.descricao || !i.bitola)) {
      toast.error('Preencha todos os itens corretamente');
      return;
    }

    const data = { projetoId, motivo, dataSolicitacao, revisao, erp, notas, status, itens };

    if (existing) {
      updateSolicitacao(existing.id, data);
      toast.success('Solicitação atualizada');
    } else {
      addSolicitacao(data);
      toast.success('Solicitação criada');
    }
    navigate('/solicitacoes');
  };

  const totalGeral = itens.reduce((a, i) => a + i.custoTotal, 0);

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
                <Select value={projetoId} onValueChange={setProjetoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.numero} - {p.descricao}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Motivo *</Label>
                <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo da solicitação" />
              </div>
              <div>
                <Label>Data da Solicitação *</Label>
                <Input type="date" value={dataSolicitacao} onChange={e => setDataSolicitacao(e.target.value)} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={v => setStatus(v as SolicitacaoStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aberta">Aberta</SelectItem>
                    <SelectItem value="Aprovada">Aprovada</SelectItem>
                    <SelectItem value="Finalizada">Finalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Revisão</Label>
                <Input value={revisao} onChange={e => setRevisao(e.target.value)} />
              </div>
              <div>
                <Label>ERP</Label>
                <Input value={erp} onChange={e => setErp(e.target.value)} />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <Label>Notas</Label>
                <Textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Itens da Solicitação</CardTitle>
              <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" />Adicionar Item</Button>
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
                    <TableRow key={item.id}>
                      <TableCell>
                        <Select value={item.descricao} onValueChange={v => handleDescChange(idx, v)}>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            {descriptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={item.bitola} onValueChange={v => handleBitolaChange(idx, v)} disabled={!item.descricao}>
                          <SelectTrigger><SelectValue placeholder="Bitola" /></SelectTrigger>
                          <SelectContent>
                            {getBitolas(item.descricao).map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={1} value={item.quantidade} onChange={e => handleQtdChange(idx, parseInt(e.target.value) || 0)} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.unidade}</TableCell>
                      <TableCell className="text-right font-mono">{formatBRL(item.custoUnitario)}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatBRL(item.custoTotal)}</TableCell>
                      <TableCell>
                        {itens.length > 1 && (
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
          <Button variant="outline" onClick={() => navigate('/solicitacoes')}>Cancelar</Button>
          <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" />Salvar Solicitação</Button>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useSolicitacoes, useProjects } from '@/hooks/useSupabaseData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatBRL } from '@/lib/formatCurrency';

type SolicitacaoStatus = 'Aberta' | 'Aprovada' | 'Finalizada';

const statusColors: Record<SolicitacaoStatus, string> = {
  Aberta: 'bg-warning text-warning-foreground',
  Aprovada: 'bg-info text-info-foreground',
  Finalizada: 'bg-success text-success-foreground',
};

export default function SolicitacoesPage() {
  const { data: solicitacoes = [] } = useSolicitacoes();
  const { data: projects = [] } = useProjects();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projetoFilter, setProjetoFilter] = useState('all');
  const [orderFilter, setOrderFilter] = useState<'all' | 'abertas' | 'finalizadas'>('all');

  const filtered = useMemo(() => solicitacoes.filter(s => {
    if (orderFilter === 'abertas' && s.status === 'Finalizada') return false;
    if (orderFilter === 'finalizadas' && s.status !== 'Finalizada') return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (projetoFilter !== 'all' && s.projeto_id !== projetoFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const proj = projects.find(p => p.id === s.projeto_id);
      return s.numero.toLowerCase().includes(q) ||
        s.motivo.toLowerCase().includes(q) ||
        s.erp.toLowerCase().includes(q) ||
        (proj?.descricao.toLowerCase().includes(q) ?? false);
    }
    return true;
  }), [solicitacoes, search, statusFilter, projetoFilter, orderFilter, projects]);

  const getProjetoNome = (id: string) => {
    const p = projects.find(x => x.id === id);
    return p ? `${p.numero} - ${p.descricao}` : 'N/A';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Solicitações</h1>
        <Button onClick={() => navigate('/solicitacoes/nova')}><Plus className="h-4 w-4 mr-2" />Criar Nova Solicitação</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-10" placeholder="Buscar solicitações..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="Aberta">Aberta</SelectItem>
                  <SelectItem value="Aprovada">Aprovada</SelectItem>
                  <SelectItem value="Finalizada">Finalizada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={projetoFilter} onValueChange={setProjetoFilter}>
                <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Projeto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Projetos</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.numero} - {p.descricao}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant={orderFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setOrderFilter('all')}>Todas</Button>
              <Button variant={orderFilter === 'abertas' ? 'default' : 'outline'} size="sm" onClick={() => setOrderFilter('abertas')}>Abertas</Button>
              <Button variant={orderFilter === 'finalizadas' ? 'default' : 'outline'} size="sm" onClick={() => setOrderFilter('finalizadas')}>Finalizadas</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center">Itens</TableHead>
                  <TableHead>ERP</TableHead>
                  <TableHead className="text-right">Custo Total</TableHead>
                  <TableHead className="w-16">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma solicitação encontrada</TableCell></TableRow>
                ) : filtered.map(s => {
                  const itens = s.solicitacao_itens || [];
                  return (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/solicitacoes/${s.id}`)}>
                      <TableCell className="font-mono font-medium">{s.numero}</TableCell>
                      <TableCell className="max-w-xs truncate">{getProjetoNome(s.projeto_id)}</TableCell>
                      <TableCell><Badge className={statusColors[s.status as SolicitacaoStatus] || ''}>{s.status}</Badge></TableCell>
                      <TableCell className="max-w-xs truncate">{s.motivo}</TableCell>
                      <TableCell className="text-muted-foreground">{s.data_solicitacao}</TableCell>
                      <TableCell className="text-center">{itens.length}</TableCell>
                      <TableCell className="font-mono">{s.erp || '-'}</TableCell>
                      <TableCell className="text-right font-mono">{formatBRL(itens.reduce((a: number, i: any) => a + (i.custo_total || 0), 0))}</TableCell>
                      <TableCell><Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useMaterials, useProjects, useSolicitacoes } from '@/hooks/useSupabaseData';
import { FolderKanban, FileText, Database, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { formatBRL } from '@/lib/formatCurrency';

export default function DashboardPage() {
  const { data: projects = [] } = useProjects();
  const { data: solicitacoes = [] } = useSolicitacoes();
  const { data: materials = [] } = useMaterials();

  const abertas = solicitacoes.filter(s => s.status === 'Aberta').length;
  const aprovadas = solicitacoes.filter(s => s.status === 'Aprovada').length;
  const finalizadas = solicitacoes.filter(s => s.status === 'Finalizada').length;
  const totalCusto = solicitacoes.reduce((acc, s) =>
    acc + (s.solicitacao_itens || []).reduce((a: number, i: any) => a + (i.custo_total || 0), 0), 0
  );

  const stats = [
    { label: 'Projetos', value: projects.length, icon: FolderKanban, to: '/projetos', color: 'text-primary' },
    { label: 'Solicitações', value: solicitacoes.length, icon: FileText, to: '/projetos', color: 'text-info' },
    { label: 'Materiais', value: materials.length, icon: Database, to: '/base-dados', color: 'text-accent' },
    { label: 'Total Custos', value: formatBRL(totalCusto), icon: TrendingUp, to: '/projetos', color: 'text-success' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, to, color }) => (
          <Link key={label} to={to}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className={`h-5 w-5 ${color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Abertas</CardTitle></CardHeader>
          <CardContent><span className="text-3xl font-bold text-warning">{abertas}</span></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Aprovadas</CardTitle></CardHeader>
          <CardContent><span className="text-3xl font-bold text-info">{aprovadas}</span></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Finalizadas</CardTitle></CardHeader>
          <CardContent><span className="text-3xl font-bold text-success">{finalizadas}</span></CardContent>
        </Card>
      </div>
    </div>
  );
}

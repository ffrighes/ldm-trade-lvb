import { FileText, FolderOpen, Layers, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRL } from '@/lib/formatCurrency';
import type { SolicitacoesKpis } from '@/hooks/useSupabaseData';

interface Props {
  kpis: SolicitacoesKpis | undefined;
  isLoading: boolean;
}

interface CardSpec {
  label: string;
  value: string;
  hint?: string;
  Icon: typeof FileText;
  accent: string;
}

export function KpiCards({ kpis, isLoading }: Props) {
  const cards: CardSpec[] = kpis
    ? [
        {
          label: 'Solicitações abertas',
          value: kpis.total_abertas.toLocaleString('pt-BR'),
          hint: `${kpis.total_solicitacoes.toLocaleString('pt-BR')} no total`,
          Icon: FolderOpen,
          accent: 'text-warning',
        },
        {
          label: 'Valor em aberto',
          value: formatBRL(kpis.valor_abertas),
          hint: `Total: ${formatBRL(kpis.valor_total)}`,
          Icon: TrendingUp,
          accent: 'text-info',
        },
        {
          label: 'Itens pendentes',
          value: kpis.itens_pendentes.toLocaleString('pt-BR'),
          hint: 'Em solicitações não finalizadas',
          Icon: Layers,
          accent: 'text-primary',
        },
        {
          label: 'Ticket médio',
          value: formatBRL(kpis.ticket_medio),
          hint: 'Valor médio por solicitação',
          Icon: FileText,
          accent: 'text-success',
        },
      ]
    : [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {isLoading || !kpis
        ? Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-7 w-32 mb-1" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))
        : cards.map(({ label, value, hint, Icon, accent }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide truncate">{label}</div>
                    <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
                    {hint && <div className="text-xs text-muted-foreground mt-1 truncate">{hint}</div>}
                  </div>
                  <Icon className={`h-5 w-5 shrink-0 ${accent}`} aria-hidden />
                </div>
              </CardContent>
            </Card>
          ))}
    </div>
  );
}

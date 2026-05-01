import { useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronUp, FilePlus2, FileX2, History, Loader2, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSolicitacaoAudit, type SolicitacaoAuditEntry } from '@/hooks/useSolicitacaoActivity';
import { formatBRL } from '@/lib/formatCurrency';

interface Props {
  solicitacaoId: string;
}

// Fields whose changes we don't want to highlight in the timeline (machine
// metadata, internal IDs, etc.).
const HIDDEN_FIELDS = new Set(['created_at', 'id']);

// Friendlier labels per column.
const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  motivo: 'Motivo',
  data_solicitacao: 'Data',
  revisao: 'Revisão',
  erp: 'ERP',
  notas: 'Notas',
  desenho: 'Desenho',
  numero: 'Nº',
  projeto_id: 'Projeto',
};

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') {
    if (field.includes('custo') || field.includes('valor')) return formatBRL(value);
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}

function ActionIcon({ action }: { action: SolicitacaoAuditEntry['action'] }) {
  if (action === 'INSERT') return <FilePlus2 className="h-4 w-4 text-success" />;
  if (action === 'DELETE') return <FileX2 className="h-4 w-4 text-destructive" />;
  return <Pencil className="h-4 w-4 text-info" />;
}

function actionLabel(action: SolicitacaoAuditEntry['action']): string {
  if (action === 'INSERT') return 'Criada';
  if (action === 'DELETE') return 'Excluída';
  return 'Alterada';
}

function visibleChangedFields(entry: SolicitacaoAuditEntry): string[] {
  const fields = entry.changed_fields ?? [];
  return fields.filter((f) => !HIDDEN_FIELDS.has(f));
}

function AuditEntry({ entry }: { entry: SolicitacaoAuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const fields = visibleChangedFields(entry);
  const isUpdate = entry.action === 'UPDATE';
  const isStatusChange = isUpdate && fields.includes('status');

  return (
    <li className="relative pl-8">
      <span className="absolute left-2 top-1.5 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-1 ring-border">
        <ActionIcon action={entry.action} />
      </span>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium">{actionLabel(entry.action)}</span>
        {isStatusChange && entry.before && entry.after && (
          <span className="text-sm">
            <Badge variant="outline" className="mr-1 line-through opacity-60">
              {String(entry.before.status ?? '')}
            </Badge>
            →
            <Badge variant="outline" className="ml-1">
              {String(entry.after.status ?? '')}
            </Badge>
          </span>
        )}
        <span className="text-xs text-muted-foreground" title={format(new Date(entry.at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}>
          {formatDistanceToNow(new Date(entry.at), { locale: ptBR, addSuffix: true })}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        por {entry.actor_email ?? 'sistema'}
      </div>
      {isUpdate && fields.length > 0 && !isStatusChange && (
        <div className="mt-1 text-xs text-muted-foreground">
          Campos alterados: {fields.map((f) => FIELD_LABELS[f] ?? f).join(', ')}
        </div>
      )}
      {isUpdate && fields.length > 0 && (
        <div className="mt-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setExpanded((v) => !v)}>
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Ocultar diferenças
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Ver diferenças
              </>
            )}
          </Button>
          {expanded && (
            <div className="mt-2 rounded border bg-muted/30 p-2 text-xs space-y-1">
              {fields.map((f) => (
                <div key={f} className="grid grid-cols-[120px_1fr_1fr] gap-2">
                  <span className="font-medium">{FIELD_LABELS[f] ?? f}</span>
                  <span className="text-destructive line-through truncate" title={formatFieldValue(f, entry.before?.[f])}>
                    {formatFieldValue(f, entry.before?.[f])}
                  </span>
                  <span className="text-success truncate" title={formatFieldValue(f, entry.after?.[f])}>
                    {formatFieldValue(f, entry.after?.[f])}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function AuditTimeline({ solicitacaoId }: Props) {
  const { data: entries = [], isLoading } = useSolicitacaoAudit(solicitacaoId);

  // Drop UPDATE entries with no visible changes (e.g. only created_at touched).
  const visible = useMemo(
    () =>
      entries.filter((e) => {
        if (e.action !== 'UPDATE') return true;
        return visibleChangedFields(e).length > 0;
      }),
    [entries],
  );

  if (isLoading) {
    return (
      <div className="py-6 text-center text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />Carregando histórico…
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Sem histórico registrado.</p>
        <p className="text-xs mt-1">As alterações aparecerão aqui após a próxima edição.</p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 border-l ml-2 pl-2">
      {visible.map((entry) => (
        <AuditEntry key={entry.id} entry={entry} />
      ))}
    </ol>
  );
}

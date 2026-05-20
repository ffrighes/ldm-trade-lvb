import { useMemo } from 'react';
import { Diamond, Package, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  type Assembly,
  type BomRow,
  useExplodeBom,
} from '@/hooks/useAssemblyBom';

interface Props {
  rootId: string;
  assembliesById: Record<string, Assembly>;
}

function fmtQty(n: number): string {
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(3).replace(/\.?0+$/, '');
}

function fmtWeight(kg: number): string {
  return `${kg % 1 === 0 ? kg.toFixed(1) : kg.toFixed(3)} kg`;
}

interface BomRowWithAssembly extends BomRow {
  assembly: Assembly | undefined;
}

export function BomExplodedTree({ rootId, assembliesById }: Props) {
  const { data: rows = [], isLoading, error } = useExplodeBom(rootId);

  const rowsWithAssembly = useMemo<BomRowWithAssembly[]>(
    () => rows.map((r) => ({ ...r, assembly: assembliesById[r.descendant_id] })),
    [rows, assembliesById],
  );

  // Compute total weight of root's direct/indirect content
  const { totalWeight, hasPartialWeight } = useMemo(() => {
    let total = 0;
    let partial = false;
    for (const r of rowsWithAssembly) {
      if (r.assembly?.unit_weight != null) {
        total += r.effective_quantity * r.assembly.unit_weight;
      } else {
        partial = true;
      }
    }
    return { totalWeight: total, hasPartialWeight: partial };
  }, [rowsWithAssembly]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        <span className="animate-pulse">Calculando BOM…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-8 px-4 text-destructive text-sm">
        <AlertCircle className="h-4 w-4" />
        Erro ao calcular BOM: {error.message}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Este assembly não tem filhos — nenhum BOM para explodir.
      </div>
    );
  }

  // Group by level for indentation
  const maxLevel = Math.max(...rows.map((r) => r.level));

  return (
    <div className="space-y-0">
      {/* Header totals */}
      <div className="flex items-center justify-between px-3 py-2 mb-1 bg-muted/30 rounded-md border border-border/50">
        <span className="text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? 'componente' : 'componentes'} ·{' '}
          {maxLevel} {maxLevel === 1 ? 'nível' : 'níveis'}
        </span>
        <div className="text-xs text-muted-foreground font-mono">
          Peso total:{' '}
          <span className="text-foreground font-semibold">{fmtWeight(totalWeight)}</span>
          {hasPartialWeight && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-1.5 text-amber-500 cursor-help">[dados parciais]</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-56 text-xs">
                  Um ou mais componentes não têm peso unitário definido. O total exclui esses
                  componentes, em vez de assumir zero.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground border-b border-border/50">
        <span>Componente</span>
        <span className="text-right w-20">Qtd. efetiva</span>
        <span className="text-right w-20">Peso unit.</span>
        <span className="text-right w-20">Peso total</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/30">
        {rowsWithAssembly.map((r) => {
          const a = r.assembly;
          const indent = (r.level - 1) * 20;
          const weightTotal =
            a?.unit_weight != null ? r.effective_quantity * a.unit_weight : null;

          return (
            <div
              key={r.descendant_id}
              className={`grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2.5 items-center transition-colors hover:bg-muted/30 ${
                r.is_multi_path ? 'bg-amber-500/5' : ''
              }`}
            >
              {/* Name + code */}
              <div className="flex items-center gap-2 min-w-0" style={{ paddingLeft: indent }}>
                {/* Tree connector */}
                <div className="flex-shrink-0 flex items-center gap-0.5">
                  {r.level > 1 && (
                    <div className="w-4 h-px bg-border" />
                  )}
                  {r.is_multi_path ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Diamond className="h-3 w-3 text-amber-500 flex-shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent className="text-xs max-w-52">
                          Nó compartilhado — aparece em múltiplos caminhos (diamante). A quantidade
                          efetiva é a soma de todos os caminhos.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Package className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                  )}
                </div>

                <div className="min-w-0">
                  {a ? (
                    <>
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {a.code}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground truncate">{a.name}</span>
                    </>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.descendant_id.slice(0, 8)}…
                    </span>
                  )}
                </div>

                {r.is_multi_path && (
                  <Badge className="ml-1 text-[9px] px-1.5 py-0 h-4 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-normal flex-shrink-0">
                    ×{r.level > 1 ? 'multi' : ''}
                  </Badge>
                )}
              </div>

              {/* Effective quantity */}
              <span className="font-mono text-xs text-right w-20 tabular-nums font-semibold text-foreground">
                {fmtQty(r.effective_quantity)}
              </span>

              {/* Unit weight */}
              <span className="font-mono text-xs text-right w-20 tabular-nums text-muted-foreground">
                {a?.unit_weight != null ? fmtWeight(a.unit_weight) : '—'}
              </span>

              {/* Total weight */}
              <span
                className={`font-mono text-xs text-right w-20 tabular-nums ${
                  weightTotal != null ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {weightTotal != null ? fmtWeight(weightTotal) : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

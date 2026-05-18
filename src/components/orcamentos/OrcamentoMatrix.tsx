import { useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Info } from 'lucide-react';
import { BestPriceBadge } from './BestPriceBadge';
import { SemCotacaoVigenteBadge } from './SemCotacaoVigenteBadge';
import {
  calcPrecoFinal,
  bestPriceIndex,
  formatBRL,
  formatPct,
  type RegimeTributario,
} from '@/lib/orcamentoMath';
import type { OrcamentoItem, OrcamentoItemCotacao, OrcamentoDetalhe } from '@/hooks/useOrcamentos';

interface Props {
  itens: OrcamentoItem[];
  fornecedores: OrcamentoDetalhe['fornecedores'];
  cotacoes: OrcamentoItemCotacao[];
  canEdit: boolean;
  onEditQty: (item: OrcamentoItem, qty: number) => void;
  onDeleteItem: (item: OrcamentoItem) => void;
  onEditCotacao: (cotacao: OrcamentoItemCotacao) => void;
}

interface CellData {
  cotacao: OrcamentoItemCotacao | undefined;
  total: number;
  regime: RegimeTributario;
}

export function OrcamentoMatrix({
  itens,
  fornecedores,
  cotacoes,
  canEdit,
  onEditQty,
  onDeleteItem,
  onEditCotacao,
}: Props) {
  const cotMap = useMemo(() => {
    const m = new Map<string, OrcamentoItemCotacao>();
    for (const c of cotacoes) m.set(`${c.item_id}|${c.fornecedor_id}`, c);
    return m;
  }, [cotacoes]);

  const totaisPorFornecedor = useMemo(() => {
    return fornecedores.map((of) => {
      const regime = (of.fornecedor.regime_tributario as RegimeTributario) ?? 'lucro_real';
      return itens.reduce((acc, item) => {
        const cot = cotMap.get(`${item.id}|${of.fornecedor_id}`);
        if (!cot || cot.sem_cotacao_vigente) return acc;
        return acc + calcPrecoFinal(cot, regime).preco_final_unit * item.quantidade;
      }, 0);
    });
  }, [itens, fornecedores, cotMap]);

  const totalBestPrice = useMemo(() => {
    return itens.reduce((acc, item) => {
      const lineTotals = fornecedores.map((of) => {
        const regime = (of.fornecedor.regime_tributario as RegimeTributario) ?? 'lucro_real';
        const cot = cotMap.get(`${item.id}|${of.fornecedor_id}`);
        if (!cot || cot.sem_cotacao_vigente) return Infinity;
        return calcPrecoFinal(cot, regime).preco_final_unit * item.quantidade;
      });
      const min = Math.min(...lineTotals);
      return acc + (min === Infinity ? 0 : min);
    }, 0);
  }, [itens, fornecedores, cotMap]);

  if (itens.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum item no orçamento. Clique em "Adicionar item" para começar.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="text-left px-3 py-2 font-medium min-w-[200px]">Item</th>
            <th className="text-center px-2 py-2 font-medium w-20">Qtd.</th>
            <th className="text-center px-2 py-2 font-medium w-16">Un.</th>
            {fornecedores.map((of) => (
              <th key={of.fornecedor_id} className="text-center px-3 py-2 font-medium min-w-[140px]">
                <div>{of.fornecedor.nome}</div>
                <div className="text-[10px] text-muted-foreground font-normal">
                  {of.fornecedor.regime_tributario.replace(/_/g, ' ')}
                </div>
              </th>
            ))}
            {canEdit && <th className="w-16" />}
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => {
            const lineTotals = fornecedores.map((of) => {
              const regime = (of.fornecedor.regime_tributario as RegimeTributario) ?? 'lucro_real';
              const cot = cotMap.get(`${item.id}|${of.fornecedor_id}`);
              if (!cot || cot.sem_cotacao_vigente) return Infinity;
              return calcPrecoFinal(cot, regime).preco_final_unit * item.quantidade;
            });
            const semCotacao = fornecedores.map((of) => {
              const cot = cotMap.get(`${item.id}|${of.fornecedor_id}`);
              return !cot || cot.sem_cotacao_vigente;
            });
            const bestIdx = bestPriceIndex(lineTotals, semCotacao);

            return (
              <tr key={item.id} className="border-b hover:bg-muted/20">
                <td className="px-3 py-2">
                  <div className="font-medium">{item.descricao}</div>
                  {item.bitola && <div className="text-xs text-muted-foreground">{item.bitola}</div>}
                  {item.erp && <div className="text-xs text-muted-foreground font-mono">{item.erp}</div>}
                </td>
                <td className="px-2 py-2 text-center">
                  {canEdit ? (
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      className="w-20 h-7 text-center text-xs"
                      defaultValue={item.quantidade}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v !== item.quantidade) onEditQty(item, v);
                      }}
                    />
                  ) : (
                    item.quantidade
                  )}
                </td>
                <td className="px-2 py-2 text-center text-muted-foreground">{item.unidade}</td>
                {fornecedores.map((of, idx) => {
                  const regime = (of.fornecedor.regime_tributario as RegimeTributario) ?? 'lucro_real';
                  const cot = cotMap.get(`${item.id}|${of.fornecedor_id}`);
                  const isBest = bestIdx === idx;

                  if (!cot) {
                    return (
                      <td key={of.fornecedor_id} className="px-3 py-2 text-center text-muted-foreground text-xs">
                        —
                      </td>
                    );
                  }

                  if (cot.sem_cotacao_vigente) {
                    return (
                      <td key={of.fornecedor_id} className="px-3 py-2 text-center">
                        <SemCotacaoVigenteBadge />
                      </td>
                    );
                  }

                  const calc = calcPrecoFinal(cot, regime);
                  const total = calc.preco_final_unit * item.quantidade;

                  return (
                    <td
                      key={of.fornecedor_id}
                      className={`px-3 py-2 text-center ${isBest ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-medium">{formatBRL(total)}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatBRL(calc.preco_final_unit)} / {item.unidade}
                        </span>
                        {isBest && <BestPriceBadge />}
                        <div className="flex gap-1">
                          <ImpostosPopover calc={calc} cot={cot} regime={regime} />
                          {canEdit && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5"
                              onClick={() => onEditCotacao(cot)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </td>
                  );
                })}
                {canEdit && (
                  <td className="px-2 py-2 text-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onDeleteItem(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 bg-muted/40 font-semibold">
            <td className="px-3 py-2" colSpan={3}>
              Total por fornecedor
            </td>
            {totaisPorFornecedor.map((total, idx) => (
              <td key={fornecedores[idx].fornecedor_id} className="px-3 py-2 text-center">
                {formatBRL(total)}
              </td>
            ))}
            {canEdit && <td />}
          </tr>
          <tr className="bg-emerald-50 dark:bg-emerald-950/20 font-semibold text-emerald-700 dark:text-emerald-400">
            <td className="px-3 py-2" colSpan={3}>
              Total best-price (menor por linha)
            </td>
            <td className="px-3 py-2 text-center" colSpan={Math.max(fornecedores.length, 1)}>
              {formatBRL(totalBestPrice)}
            </td>
            {canEdit && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ImpostosPopover({
  calc,
  cot,
  regime,
}: {
  calc: ReturnType<typeof calcPrecoFinal>;
  cot: OrcamentoItemCotacao;
  regime: RegimeTributario;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="h-5 w-5">
          <Info className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-xs space-y-1" side="top">
        <p className="font-semibold mb-2">Breakdown de impostos</p>
        <Row label="Valor unitário" value={formatBRL(cot.valor_unitario)} />
        <Row label="Desconto" value={formatPct(cot.desconto_pct)} />
        <Row label="Base líquida" value={formatBRL(calc.base_liquida)} />
        <hr />
        <Row label={`IPI (${formatPct(cot.ipi_pct)})`} value={formatBRL(calc.ipi_valor)} />
        <Row
          label={`ICMS (${formatPct(cot.icms_pct)})`}
          value={formatBRL(calc.icms_valor)}
          info={regime !== 'simples_nacional' ? 'informativo' : undefined}
        />
        <Row
          label={`PIS (${formatPct(cot.pis_pct)})`}
          value={formatBRL(calc.pis_valor)}
          info={regime !== 'simples_nacional' ? 'informativo' : undefined}
        />
        <Row
          label={`COFINS (${formatPct(cot.cofins_pct)})`}
          value={formatBRL(calc.cofins_valor)}
          info={regime !== 'simples_nacional' ? 'informativo' : undefined}
        />
        <hr />
        <Row label="Preço final unit." value={formatBRL(calc.preco_final_unit)} bold />
        {cot.lead_time_dias != null && (
          <Row label="Lead time" value={`${cot.lead_time_dias} dias`} />
        )}
        {cot.moq != null && <Row label="MOQ" value={String(cot.moq)} />}
      </PopoverContent>
    </Popover>
  );
}

function Row({
  label,
  value,
  bold,
  info,
}: {
  label: string;
  value: string;
  bold?: boolean;
  info?: string;
}) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold' : ''}`}>
      <span className="text-muted-foreground">
        {label}
        {info && <span className="ml-1 text-[9px] opacity-60">({info})</span>}
      </span>
      <span>{value}</span>
    </div>
  );
}

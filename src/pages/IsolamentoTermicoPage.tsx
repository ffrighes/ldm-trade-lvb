import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Copy, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { calcularLinha, calcularTotais } from '@/lib/isolamentoCalc';
import {
  BITOLAS_ORDENADAS,
  MATERIAIS_CHAPA,
  MATERIAIS_ISOLAMENTO,
} from '@/lib/isolamentoData';

// ─── Formatting helpers (pt-BR) ────────────────────────────────────────────

function fmt(n: number | null, casas: number): string {
  if (n === null || Number.isNaN(n)) return '—';
  return n.toFixed(casas).replace('.', ',');
}

// ─── Row state ──────────────────────────────────────────────────────────────

interface LinhaIsolamentoUI {
  id: string;
  linha: string;
  bitola: string;
  comprimentoM: number;
  espessuraIsolMm: number;
  materialChapa: string;
  espessuraChapaMm: number;
  materialIsol: string;
}

let contador = 0;
function novoId(): string {
  contador += 1;
  return `linha-isol-${Date.now()}-${contador}`;
}

function linhaVazia(indice: number): LinhaIsolamentoUI {
  return {
    id: novoId(),
    linha: `Linha ${indice}`,
    bitola: BITOLAS_ORDENADAS[0] ?? '',
    comprimentoM: 0,
    espessuraIsolMm: 0,
    materialChapa: MATERIAIS_CHAPA[0] ?? '',
    espessuraChapaMm: 0,
    materialIsol: MATERIAIS_ISOLAMENTO[0] ?? '',
  };
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function IsolamentoTermicoPage() {
  const { projetoId } = useParams<{ projetoId: string }>();
  const navigate = useNavigate();

  const [linhas, setLinhas] = useState<LinhaIsolamentoUI[]>(() => [linhaVazia(1)]);

  const resultados = useMemo(
    () =>
      linhas.map((l) => ({
        linha: l,
        resultado: calcularLinha({
          bitola: l.bitola,
          comprimentoM: l.comprimentoM,
          espessuraIsolMm: l.espessuraIsolMm,
          materialChapa: l.materialChapa,
          espessuraChapaMm: l.espessuraChapaMm,
          materialIsol: l.materialIsol,
        }),
      })),
    [linhas],
  );

  const totais = useMemo(
    () => calcularTotais(resultados.map((r) => r.resultado)),
    [resultados],
  );

  function updateLinha(id: string, updates: Partial<LinhaIsolamentoUI>) {
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
  }

  function addLinha() {
    setLinhas((prev) => [...prev, linhaVazia(prev.length + 1)]);
  }

  function removeLinha(id: string) {
    setLinhas((prev) => prev.filter((l) => l.id !== id));
  }

  function duplicarLinha(id: string) {
    setLinhas((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx === -1) return prev;
      const copia: LinhaIsolamentoUI = { ...prev[idx], id: novoId() };
      const next = [...prev];
      next.splice(idx + 1, 0, copia);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => navigate(`/projetos/${projetoId}/calculos`)}
        >
          <ArrowLeft className="h-4 w-4" />
          Cálculos
        </Button>
        <h1 className="text-xl font-bold">Isolamento Térmico</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Linha</TableHead>
                  <TableHead>Ø</TableHead>
                  <TableHead className="text-right text-muted-foreground/70">Diâmetro (mm)</TableHead>
                  <TableHead className="text-right">Compr. (m)</TableHead>
                  <TableHead className="text-right">Espessura Isol. (mm)</TableHead>
                  <TableHead className="text-right text-muted-foreground/70">Diâmetro Isol. (mm)</TableHead>
                  <TableHead className="text-right text-muted-foreground/70">Volume Isol. (m³)</TableHead>
                  <TableHead className="text-right text-muted-foreground/70">Perímetro (mm)</TableHead>
                  <TableHead className="text-right text-muted-foreground/70">Área de chapa (m²)</TableHead>
                  <TableHead>Material Chapa</TableHead>
                  <TableHead className="text-right">Espessura Chapa (mm)</TableHead>
                  <TableHead className="text-right text-muted-foreground/70">Peso da chapa (Kg)</TableHead>
                  <TableHead className="text-right text-muted-foreground/70">Peso Isol (Kg)</TableHead>
                  <TableHead>Material do Isolamento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultados.map(({ linha, resultado }) => (
                  <TableRow
                    key={linha.id}
                    className={cn(resultado.erro && 'bg-destructive/5 hover:bg-destructive/10')}
                  >
                    <TableCell>
                      <Label htmlFor={`${linha.id}-linha`} className="sr-only">
                        Nome da linha
                      </Label>
                      <Input
                        id={`${linha.id}-linha`}
                        className="h-8 min-w-[8rem]"
                        value={linha.linha}
                        onChange={(e) => updateLinha(linha.id, { linha: e.target.value })}
                      />
                    </TableCell>

                    <TableCell>
                      <Label htmlFor={`${linha.id}-bitola`} className="sr-only">
                        Bitola
                      </Label>
                      <Select
                        value={linha.bitola}
                        onValueChange={(v) => updateLinha(linha.id, { bitola: v })}
                      >
                        <SelectTrigger id={`${linha.id}-bitola`} className="h-8 w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BITOLAS_ORDENADAS.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="text-right font-mono text-muted-foreground">
                      {fmt(resultado.diametroTuboMm, 2)}
                    </TableCell>

                    <TableCell>
                      <Label htmlFor={`${linha.id}-compr`} className="sr-only">
                        Comprimento em metros
                      </Label>
                      <Input
                        id={`${linha.id}-compr`}
                        type="number"
                        className="h-8 w-20 text-right"
                        value={linha.comprimentoM}
                        onChange={(e) =>
                          updateLinha(linha.id, { comprimentoM: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </TableCell>

                    <TableCell>
                      <Label htmlFor={`${linha.id}-esp-isol`} className="sr-only">
                        Espessura do isolamento em milímetros
                      </Label>
                      <Input
                        id={`${linha.id}-esp-isol`}
                        type="number"
                        className="h-8 w-20 text-right"
                        value={linha.espessuraIsolMm}
                        onChange={(e) =>
                          updateLinha(linha.id, { espessuraIsolMm: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </TableCell>

                    <TableCell className="text-right font-mono text-muted-foreground">
                      {fmt(resultado.diametroIsolMm, 2)}
                    </TableCell>

                    <TableCell className="text-right font-mono text-muted-foreground">
                      {fmt(resultado.erro ? null : resultado.volumeIsolM3, 3)}
                    </TableCell>

                    <TableCell className="text-right font-mono text-muted-foreground">
                      {fmt(resultado.erro ? null : resultado.perimetroMm, 2)}
                    </TableCell>

                    <TableCell className="text-right font-mono text-muted-foreground">
                      {fmt(resultado.erro ? null : resultado.areaChapaM2, 2)}
                    </TableCell>

                    <TableCell>
                      <Label htmlFor={`${linha.id}-mat-chapa`} className="sr-only">
                        Material da chapa
                      </Label>
                      <Select
                        value={linha.materialChapa}
                        onValueChange={(v) => updateLinha(linha.id, { materialChapa: v })}
                      >
                        <SelectTrigger id={`${linha.id}-mat-chapa`} className="h-8 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MATERIAIS_CHAPA.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <Label htmlFor={`${linha.id}-esp-chapa`} className="sr-only">
                        Espessura da chapa em milímetros
                      </Label>
                      <Input
                        id={`${linha.id}-esp-chapa`}
                        type="number"
                        className="h-8 w-20 text-right"
                        value={linha.espessuraChapaMm}
                        onChange={(e) =>
                          updateLinha(linha.id, { espessuraChapaMm: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </TableCell>

                    <TableCell className="text-right font-mono text-muted-foreground">
                      {fmt(resultado.erro ? null : resultado.pesoChapaKg, 1)}
                    </TableCell>

                    <TableCell className="text-right font-mono text-muted-foreground">
                      {fmt(resultado.erro ? null : resultado.pesoIsolKg, 1)}
                    </TableCell>

                    <TableCell>
                      <Label htmlFor={`${linha.id}-mat-isol`} className="sr-only">
                        Material do isolamento
                      </Label>
                      <Select
                        value={linha.materialIsol}
                        onValueChange={(v) => updateLinha(linha.id, { materialIsol: v })}
                      >
                        <SelectTrigger id={`${linha.id}-mat-isol`} className="h-8 w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MATERIAIS_ISOLAMENTO.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {resultado.erro && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-destructive">
                                <AlertTriangle className="h-4 w-4" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{resultado.erro}</TooltipContent>
                          </Tooltip>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => duplicarLinha(linha.id)}
                          aria-label={`Duplicar ${linha.linha}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeLinha(linha.id)}
                          aria-label={`Remover ${linha.linha}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {linhas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={15} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma linha. Adicione a primeira linha.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {linhas.length > 0 && (
                <tfoot>
                  <TableRow className="border-t bg-muted/30 font-medium hover:bg-muted/30">
                    <TableCell colSpan={11} className="text-right text-muted-foreground">
                      Totais
                    </TableCell>
                    <TableCell className="text-right font-mono">{fmt(totais.totalChapaKg, 1)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(totais.totalIsolKg, 1)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>

          <div className="px-4 py-3 border-t">
            <Button variant="outline" size="sm" onClick={addLinha} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Adicionar linha
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

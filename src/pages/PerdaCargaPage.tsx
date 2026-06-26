import { useState, useMemo, useCallback } from 'react';
import type { NormativaDefault } from '@/hooks/useNormativeDiameter';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import {
  ArrowLeft, Plus, Trash2, Save, AlertTriangle,
  Info, ChevronDown, ChevronUp, FlaskConical,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';

import { usePermissions } from '@/hooks/usePermissions';
import {
  useCalculos, useAddCalculo, useUpdateCalculo,
  type Calculo, type InsertCalculo,
} from '@/hooks/useCalculos';
import { FLUIDO_AGUA_20C, CATALOG_RUGOSIDADE } from '@/lib/catalogo';
import { calcCircuito, calcLinha, calcFatorAtrito, calcVelocidade, calcArea, calcPerdaAtritoPa, calcPerdaElevacaoPa, calcPerdaLocalizadaPa, G, PA_TO_BAR } from '@/lib/engine/perdaCargaEngine';
import AddElementoDialog from '@/components/perdaCarga/AddElementoDialog';

import type {
  CircuitoHidraulico, LinhaHidraulica, ElementoHidraulico,
  FluidoProps, TrechoTubo, ResultadoElemento, ResultadoLinha,
} from '@/types/perdaCarga';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimais = 4): string {
  if (n == null || isNaN(n)) return '—';
  return n.toFixed(decimais).replace('.', ',');
}

function fmtSci(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  if (n === 0) return '0';
  if (Math.abs(n) >= 0.001 && Math.abs(n) < 10000) return n.toFixed(4).replace('.', ',');
  return n.toExponential(3).replace('.', ',');
}

const CONFIANCA_COLOR: Record<string, string> = {
  alta:  'text-green-500',
  media: 'text-yellow-500',
  baixa: 'text-orange-500',
};

const REGIAO_LABEL: Record<string, string> = {
  laminar:    'Lam.',
  turbulento: 'Turb.',
  transicao:  'Trans.★',
};

// ── Formula dialog ────────────────────────────────────────────────────────────

interface FormulaDialogProps {
  elemento: ElementoHidraulico;
  resultado: ResultadoElemento;
  fluido: FluidoProps;
  Q: number;
  open: boolean;
  onClose: () => void;
}

function FormulaDialog({ elemento, resultado, fluido, Q, open, onClose }: FormulaDialogProps) {
  const nu = fluido.viscDinamica / fluido.densidade;

  function renderTrecho(t: TrechoTubo) {
    const D_m = t.diametro / 1000;
    const A   = calcArea(t.diametro);
    const v   = resultado.velocidade ?? 0;
    const Re  = resultado.reynolds ?? 0;
    const f   = resultado.fatorAtrito ?? 0;
    const L_m = t.comprimento / 1000;
    const Dz_m = t.desnivel / 1000;
    const dpAtrito = calcPerdaAtritoPa(f, t.comprimento, t.diametro, fluido.densidade, v);
    const dpElev   = calcPerdaElevacaoPa(t.desnivel, fluido.densidade);
    const dpTotal  = (dpAtrito + dpElev) * t.quantidade;

    return (
      <div className="space-y-3 text-sm font-mono">
        <div>
          <p className="text-muted-foreground mb-1">Área transversal:</p>
          <BlockMath math={`A = \\frac{\\pi D^2}{4} = \\frac{\\pi \\times ${D_m.toFixed(4)}^2}{4} = ${A.toExponential(4)}\\ \\text{m}^2`} />
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Velocidade:</p>
          <BlockMath math={`v = \\frac{Q}{A} = \\frac{${(Q/3600).toExponential(4)}}{${A.toExponential(4)}} = ${v.toFixed(4)}\\ \\text{m/s}`} />
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Reynolds:</p>
          <BlockMath math={`Re = \\frac{v \\cdot D}{\\nu} = \\frac{${v.toFixed(4)} \\times ${D_m.toFixed(4)}}{${nu.toExponential(4)}} = ${Re.toFixed(0)}\\ (${resultado.regiao === 'laminar' ? '\\text{laminar}' : resultado.regiao === 'turbulento' ? '\\text{turbulento}' : '\\text{transição}'})`} />
        </div>
        {resultado.regiao === 'laminar' && (
          <div>
            <p className="text-muted-foreground mb-1">Fator de atrito (Hagen-Poiseuille):</p>
            <BlockMath math={`f = \\frac{64}{Re} = \\frac{64}{${Re.toFixed(0)}} = ${f.toFixed(6)}`} />
          </div>
        )}
        {resultado.regiao !== 'laminar' && (
          <div>
            <p className="text-muted-foreground mb-1">Fator de atrito (Swamee-Jain):</p>
            <BlockMath math={`f = \\frac{0{,}25}{\\left[\\log_{10}\\!\\left(\\frac{\\varepsilon/D}{3{,}7} + \\frac{5{,}74}{Re^{0{,}9}}\\right)\\right]^2} = ${f.toFixed(6)}`} />
          </div>
        )}
        <div>
          <p className="text-muted-foreground mb-1">Perda distribuída (Darcy-Weisbach):</p>
          <BlockMath math={`\\Delta P_{\\text{atrito}} = f \\cdot \\frac{L}{D} \\cdot \\frac{\\rho v^2}{2} = ${f.toFixed(6)} \\cdot \\frac{${L_m.toFixed(3)}}{${D_m.toFixed(4)}} \\cdot \\frac{${fluido.densidade} \\times ${v.toFixed(4)}^2}{2} = ${dpAtrito.toFixed(1)}\\ \\text{Pa}`} />
        </div>
        {t.desnivel !== 0 && (
          <div>
            <p className="text-muted-foreground mb-1">Parcela de elevação:</p>
            <BlockMath math={`\\Delta P_{\\text{elev}} = \\rho g \\Delta z = ${fluido.densidade} \\times ${G} \\times ${Dz_m.toFixed(4)} = ${dpElev.toFixed(1)}\\ \\text{Pa}`} />
          </div>
        )}
        <div className="rounded-none border border-primary/30 bg-primary/5 p-3">
          <p className="text-muted-foreground mb-1">Total ({t.quantidade}× trecho):</p>
          <p><strong>ΔP = {dpTotal.toFixed(1)} Pa = {(dpTotal * PA_TO_BAR).toFixed(6).replace('.',',')} bar = {(dpTotal / (fluido.densidade * G)).toFixed(4).replace('.',',')} m.c.a.</strong></p>
        </div>
      </div>
    );
  }

  function renderFitting() {
    const elAny = elemento as { diametro?: number; k?: number };
    const D = elAny.diametro ?? 0;
    const K = elAny.k ?? 0;
    const v = resultado.velocidade ?? 0;
    const dpPa = calcPerdaLocalizadaPa(K, fluido.densidade, v, elemento.quantidade);

    return (
      <div className="space-y-3 text-sm font-mono">
        <div>
          <p className="text-muted-foreground mb-1">Velocidade:</p>
          <BlockMath math={`v = \\frac{Q}{A} = ${v.toFixed(4)}\\ \\text{m/s}`} />
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Perda localizada — método K:</p>
          <BlockMath math={`\\Delta P = n \\cdot K \\cdot \\frac{\\rho v^2}{2} = ${elemento.quantidade} \\times ${K} \\times \\frac{${fluido.densidade} \\times ${v.toFixed(4)}^2}{2} = ${dpPa.toFixed(1)}\\ \\text{Pa}`} />
        </div>
        <div className="rounded-none border border-primary/30 bg-primary/5 p-3">
          <p><strong>ΔP = {dpPa.toFixed(1)} Pa = {(dpPa * PA_TO_BAR).toFixed(6).replace('.',',')} bar = {(dpPa / (fluido.densidade * G)).toFixed(4).replace('.',',')} m.c.a.</strong></p>
        </div>
      </div>
    );
  }

  const title =
    elemento.tipo === 'trecho' ? `Trecho — ${(elemento as TrechoTubo).material}` :
    'tipo' in elemento && 'label' in elemento ? (elemento as any).label :
    elemento.tipo === 'filtro' ? 'Filtro' : 'Acessório';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono">{title} — Detalhes do Cálculo</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {elemento.tipo === 'trecho'
            ? renderTrecho(elemento as TrechoTubo)
            : renderFitting()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Element row ───────────────────────────────────────────────────────────────

interface ElementoRowProps {
  elemento: ElementoHidraulico;
  resultado: ResultadoElemento;
  fluido: FluidoProps;
  Q: number;
  onRemove: () => void;
  onUpdate: (updates: Partial<ElementoHidraulico>) => void;
  readonly: boolean;
}

function ElementoRow({ elemento, resultado, fluido, Q, onRemove, onUpdate, readonly }: ElementoRowProps) {
  const [formulaOpen, setFormulaOpen] = useState(false);

  const label = (() => {
    if (elemento.tipo === 'trecho') return `Trecho — ${(elemento as TrechoTubo).material}`;
    if ('label' in elemento)        return (elemento as any).label;
    if (elemento.tipo === 'filtro') return 'Filtro';
    if (elemento.tipo === 'acessorio') return (elemento as any).nome;
    return elemento.tipo;
  })();

  const params = (() => {
    if (elemento.tipo === 'trecho') {
      const t = elemento as TrechoTubo;
      return `L=${(t.comprimento/1000).toFixed(1)} m  D=${t.diametro} mm  ε=${t.rugosidade}`;
    }
    if (elemento.tipo === 'filtro') {
      const f = elemento as any;
      return f.modo === 'cv_fabricante' ? `Cv=${f.cv ?? '?'} (${f.cvUnidade ?? 'SI'})` : `K=${f.k ?? 2}`;
    }
    if ('k' in elemento) return `K=${(elemento as any).k}`;
    return '';
  })();

  const warningColor = resultado.erro
    ? 'text-destructive'
    : resultado.aviso?.includes('Dados Insuficientes')
    ? 'text-orange-500'
    : resultado.aviso
    ? 'text-yellow-500'
    : '';

  return (
    <>
      <tr className={`border-b last:border-0 text-xs hover:bg-muted/20 transition-colors ${warningColor}`}>
        <td className="px-2 py-2">
          <div className="font-medium">{label}</div>
          <div className="text-muted-foreground font-mono text-[11px]">{params}</div>
          {(resultado.aviso || resultado.erro) && (
            <div className="flex items-start gap-1 mt-0.5">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              <span className="text-[11px] leading-tight">{resultado.erro ?? resultado.aviso}</span>
            </div>
          )}
        </td>
        <td className="px-2 py-2 text-right font-mono">{resultado.velocidade != null ? fmt(resultado.velocidade, 2) : '—'}</td>
        <td className="px-2 py-2 text-right font-mono">{resultado.reynolds != null ? resultado.reynolds.toFixed(0) : '—'}</td>
        <td className="px-2 py-2 text-right font-mono text-muted-foreground">
          {resultado.regiao ? (
            <span title={resultado.regiao === 'transicao' ? 'Regime de transição — resultado aproximado' : ''}>
              {REGIAO_LABEL[resultado.regiao] ?? resultado.regiao}
            </span>
          ) : '—'}
        </td>
        <td className="px-2 py-2 text-right font-mono">{resultado.fatorAtrito != null ? fmt(resultado.fatorAtrito, 4) : '—'}</td>
        <td className="px-2 py-2 text-right font-mono font-medium">{resultado.dpBar != null ? fmt(resultado.dpBar, 5) : '—'}</td>
        <td className="px-2 py-2 text-right font-mono text-muted-foreground">
          {resultado.contribuicaoPct != null ? fmt(resultado.contribuicaoPct, 1) + '%' : '—'}
        </td>
        <td className="px-2 py-2">
          <div className="flex items-center justify-end gap-0.5">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFormulaOpen(true)} aria-label="Ver fórmula">
              <FlaskConical className="h-3.5 w-3.5" />
            </Button>
            {!readonly && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onRemove} aria-label="Remover elemento">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </td>
      </tr>

      {formulaOpen && (
        <FormulaDialog
          elemento={elemento}
          resultado={resultado}
          fluido={fluido}
          Q={Q}
          open={formulaOpen}
          onClose={() => setFormulaOpen(false)}
        />
      )}
    </>
  );
}

// ── Linha card ────────────────────────────────────────────────────────────────

interface LinhaCardProps {
  linha: LinhaHidraulica;
  resultado: ResultadoLinha;
  fluido: FluidoProps;
  readonly: boolean;
  onRemoveLinha: () => void;
  onUpdateLinha: (updates: Partial<LinhaHidraulica>) => void;
  onAddElemento: (el: ElementoHidraulico) => void;
  onRemoveElemento: (id: string) => void;
  onUpdateElemento: (id: string, updates: Partial<ElementoHidraulico>) => void;
}

function LinhaCard({
  linha, resultado, fluido, readonly,
  onRemoveLinha, onUpdateLinha, onAddElemento, onRemoveElemento, onUpdateElemento,
}: LinhaCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Inherit last trecho's normative spec as default for new elements
  const defaultDimensao = useMemo<NormativaDefault | undefined>(() => {
    const trechos = linha.elementos.filter((el): el is TrechoTubo => el.tipo === 'trecho');
    const last = trechos[trechos.length - 1];
    if (!last?.norma) return undefined;
    return { norma: last.norma, nps: last.nps, schedule: last.schedule, dn: last.dn, serie_din: last.serie_din };
  }, [linha.elementos]);

  return (
    <Card className="border border-border/60">
      <CardHeader className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded((p) => !p)} aria-label={expanded ? 'Recolher linha' : 'Expandir linha'}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {readonly ? (
            <span className="font-medium text-sm flex-1">{linha.nome}</span>
          ) : (
            <Input
              className="flex-1 h-7 text-sm font-medium bg-transparent border-0 border-b border-border/40 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
              value={linha.nome}
              onChange={(e) => onUpdateLinha({ nome: e.target.value })}
            />
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-muted-foreground">Q =</span>
            {readonly ? (
              <span className="font-mono text-sm">{linha.vazao}</span>
            ) : (
              <Input
                className="w-20 h-7 text-xs font-mono text-right"
                type="number"
                min="0"
                step="0.1"
                value={linha.vazao}
                onChange={(e) => onUpdateLinha({ vazao: parseFloat(e.target.value) || 0 })}
              />
            )}
            <span className="text-xs text-muted-foreground">m³/h</span>
          </div>

          <div className="font-mono text-sm font-bold shrink-0 min-w-[90px] text-right">
            {resultado.bloqueada
              ? <span className="text-destructive text-xs">bloqueada</span>
              : <span>{fmt(resultado.dpTotalBar, 4)} bar</span>}
          </div>

          {!readonly && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" onClick={() => setDeleteOpen(true)} aria-label="Remover linha">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {resultado.avisos.length > 0 && (
          <div className="ml-10 space-y-0.5 mt-1">
            {resultado.avisos.map((a, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-warning-text">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                {a}
              </div>
            ))}
          </div>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="px-0 pb-3 pt-0">
          {linha.elementos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-y bg-muted/30">
                    <th className="px-2 py-1.5 text-left text-muted-foreground font-medium">Elemento</th>
                    <th className="px-2 py-1.5 text-right text-muted-foreground font-medium">v [m/s]</th>
                    <th className="px-2 py-1.5 text-right text-muted-foreground font-medium">Re</th>
                    <th className="px-2 py-1.5 text-right text-muted-foreground font-medium">Regime</th>
                    <th className="px-2 py-1.5 text-right text-muted-foreground font-medium">f</th>
                    <th className="px-2 py-1.5 text-right text-muted-foreground font-medium">ΔP [bar]</th>
                    <th className="px-2 py-1.5 text-right text-muted-foreground font-medium">%</th>
                    <th className="px-2 py-1.5 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {linha.elementos.map((el) => {
                    const res = resultado.elementos.find((r) => r.elementoId === el.id);
                    if (!res) return null;
                    return (
                      <ElementoRow
                        key={el.id}
                        elemento={el}
                        resultado={res}
                        fluido={fluido}
                        Q={linha.vazao}
                        readonly={readonly}
                        onRemove={() => onRemoveElemento(el.id)}
                        onUpdate={(u) => onUpdateElemento(el.id, u)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-3 text-xs text-muted-foreground italic">Nenhum elemento — adicione abaixo.</p>
          )}

          {!readonly && (
            <div className="px-4 pt-2">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Adicionar elemento
              </Button>
            </div>
          )}

          <div className="px-4 pt-2 flex items-center gap-4 text-xs text-muted-foreground border-t border-border/40 mt-2">
            <span>v_máx: <span className="font-mono text-foreground">{fmt(resultado.velocidadeMax, 2)} m/s</span></span>
            <span>ΔP: <span className="font-mono text-foreground">{resultado.bloqueada ? '—' : `${fmt(resultado.dpTotalBar, 4)} bar`}</span></span>
            <span><span className="font-mono text-foreground">{resultado.bloqueada ? '—' : `${fmt(resultado.dpTotalMca, 3)} m.c.a.`}</span></span>
          </div>
        </CardContent>
      )}

      {addOpen && (
        <AddElementoDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onConfirm={(el) => { onAddElemento(el); setAddOpen(false); }}
          defaultDimensao={defaultDimensao}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir linha?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{linha.nome}</strong> e todos os seus elementos serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onRemoveLinha}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const FORMULA_PRINCIPAL = '\\Delta P_{\\text{total}} = f \\cdot \\frac{L}{D} \\cdot \\frac{\\rho v^2}{2} + \\sum K \\cdot \\frac{\\rho v^2}{2} + \\rho g \\Delta z';

export default function PerdaCargaPage() {
  const { projetoId, calculoId } = useParams<{ projetoId: string; calculoId?: string }>();
  const navigate = useNavigate();
  const { canCreateCalculo, canEditCalculo } = usePermissions();

  const { data: calculos = [] } = useCalculos(projetoId);
  const addCalculo  = useAddCalculo();
  const updateCalculo = useUpdateCalculo();

  // Find existing calculo if editing
  const existingCalculo: Calculo | undefined = calculos.find((c) => c.id === calculoId);

  // ── Local state ───────────────────────────────────────────────────────────

  const [titulo,    setTitulo]    = useState(() => existingCalculo?.titulo ?? 'Circuito sem título');
  const [revisao,   setRevisao]   = useState(() => existingCalculo?.revisao ?? '0');
  const [statusCalc, setStatus]   = useState<'Rascunho' | 'Em Revisão' | 'Aprovado'>(() =>
    (existingCalculo?.status ?? 'Rascunho') as 'Rascunho' | 'Em Revisão' | 'Aprovado');
  const [premissas, setPremissas] = useState(() => existingCalculo?.premissas ?? '');

  const [circuito, setCircuito] = useState<CircuitoHidraulico>(() => {
    if (existingCalculo) {
      try {
        return existingCalculo.valores as unknown as CircuitoHidraulico;
      } catch {
        // fallback
      }
    }
    return { fluido: { ...FLUIDO_AGUA_20C }, linhas: [] };
  });

  // ── Live calculation ──────────────────────────────────────────────────────

  const resultado = useMemo(() => calcCircuito(circuito), [circuito]);

  // ── Fluido ────────────────────────────────────────────────────────────────

  function updateFluido(updates: Partial<FluidoProps>) {
    setCircuito((prev) => ({ ...prev, fluido: { ...prev.fluido, ...updates } }));
  }

  // ── Linhas ────────────────────────────────────────────────────────────────

  function addLinha() {
    const id = crypto.randomUUID();
    setCircuito((prev) => ({
      ...prev,
      linhas: [
        ...prev.linhas,
        { id, nome: `Linha ${prev.linhas.length + 1}`, vazao: 0, elementos: [] },
      ],
    }));
  }

  function removeLinha(linhaId: string) {
    setCircuito((prev) => ({ ...prev, linhas: prev.linhas.filter((l) => l.id !== linhaId) }));
  }

  const updateLinha = useCallback((linhaId: string, updates: Partial<LinhaHidraulica>) => {
    setCircuito((prev) => ({
      ...prev,
      linhas: prev.linhas.map((l) => l.id === linhaId ? { ...l, ...updates } : l),
    }));
  }, []);

  // ── Elementos ─────────────────────────────────────────────────────────────

  const addElemento = useCallback((linhaId: string, el: ElementoHidraulico) => {
    setCircuito((prev) => ({
      ...prev,
      linhas: prev.linhas.map((l) =>
        l.id === linhaId ? { ...l, elementos: [...l.elementos, el] } : l,
      ),
    }));
  }, []);

  const removeElemento = useCallback((linhaId: string, elId: string) => {
    setCircuito((prev) => ({
      ...prev,
      linhas: prev.linhas.map((l) =>
        l.id === linhaId ? { ...l, elementos: l.elementos.filter((e) => e.id !== elId) } : l,
      ),
    }));
  }, []);

  const updateElemento = useCallback((linhaId: string, elId: string, updates: Partial<ElementoHidraulico>) => {
    setCircuito((prev) => ({
      ...prev,
      linhas: prev.linhas.map((l) =>
        l.id === linhaId
          ? { ...l, elementos: l.elementos.map((e) => e.id === elId ? { ...e, ...updates } : e) }
          : l,
      ),
    }));
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────

  const isReadonly = !(calculoId ? canEditCalculo : canCreateCalculo);

  async function handleSave() {
    if (!projetoId) return;

    const payload: InsertCalculo = {
      projeto_id: projetoId,
      template_id: 'perda-carga-circuito',
      titulo: titulo.trim() || 'Circuito sem título',
      tipo: 'Hidráulica — Perda de Carga',
      valores: circuito as unknown as any,
      formula: FORMULA_PRINCIPAL,
      resultado_valor: resultado.dpTotalBar > 0 ? parseFloat(resultado.dpTotalBar.toFixed(6)) : null,
      resultado_unidade: 'bar',
      premissas,
      referencias: 'Darcy-Weisbach; Crane TP-410 (Neutrium); Swamee-Jain (1976)',
      revisao,
      status: statusCalc,
    };

    try {
      if (calculoId) {
        await updateCalculo.mutateAsync({ id: calculoId, projetoId, ...payload });
        toast.success('Circuito salvo.');
      } else {
        const saved = await addCalculo.mutateAsync(payload);
        toast.success('Circuito criado.');
        navigate(`/projetos/${projetoId}/calculos/perda-carga/${saved.id}`, { replace: true });
      }
    } catch (err: unknown) {
      toast.error('Erro ao salvar.', { description: err instanceof Error ? err.message : String(err) });
    }
  }

  const isSaving = addCalculo.isPending || updateCalculo.isPending;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
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

        <div className="flex-1 min-w-0">
          {isReadonly ? (
            <h1 className="text-xl font-bold truncate">{titulo}</h1>
          ) : (
            <Input
              className="text-xl font-bold bg-transparent border-0 border-b border-border/40 rounded-none px-0 h-auto py-0.5 focus-visible:ring-0 focus-visible:border-primary max-w-md"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Rev.</span>
            {isReadonly ? (
              <span className="font-mono text-sm">{revisao}</span>
            ) : (
              <Input className="w-14 h-7 text-xs font-mono text-center" value={revisao} onChange={(e) => setRevisao(e.target.value)} />
            )}
          </div>
          {isReadonly ? (
            <Badge variant="outline">{statusCalc}</Badge>
          ) : (
            <Select value={statusCalc} onValueChange={(v) => setStatus(v as typeof statusCalc)}>
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Rascunho">Rascunho</SelectItem>
                <SelectItem value="Em Revisão">Em Revisão</SelectItem>
                <SelectItem value="Aprovado">Aprovado</SelectItem>
              </SelectContent>
            </Select>
          )}
          {!isReadonly && (
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
              <Save className="h-4 w-4" />
              {isSaving ? 'Salvando…' : 'Salvar'}
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Fluido */}
      <Card>
        <CardContent className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fluido</span>
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Nome</Label>
              {isReadonly ? (
                <span className="text-sm font-mono">{circuito.fluido.nome}</span>
              ) : (
                <Input className="w-28 h-7 text-xs" value={circuito.fluido.nome} onChange={(e) => updateFluido({ nome: e.target.value })} />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">ρ</Label>
              {isReadonly ? (
                <span className="font-mono text-sm">{circuito.fluido.densidade}</span>
              ) : (
                <Input className="w-24 h-7 text-xs font-mono" type="number" value={circuito.fluido.densidade} onChange={(e) => updateFluido({ densidade: parseFloat(e.target.value) || 0 })} />
              )}
              <span className="text-xs text-muted-foreground">kg/m³</span>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">μ</Label>
              {isReadonly ? (
                <span className="font-mono text-sm">{circuito.fluido.viscDinamica.toExponential(3)}</span>
              ) : (
                <Input className="w-28 h-7 text-xs font-mono" type="number" step="1e-5" value={circuito.fluido.viscDinamica} onChange={(e) => updateFluido({ viscDinamica: parseFloat(e.target.value) || 0 })} />
              )}
              <span className="text-xs text-muted-foreground">Pa·s</span>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">T</Label>
              {isReadonly ? (
                <span className="font-mono text-sm">{circuito.fluido.temperatura}</span>
              ) : (
                <Input className="w-20 h-7 text-xs font-mono" type="number" value={circuito.fluido.temperatura} onChange={(e) => updateFluido({ temperatura: parseFloat(e.target.value) || 0 })} />
              )}
              <span className="text-xs text-muted-foreground">°C</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-auto cursor-help">
                  <Info className="h-4 w-4 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                <p>Valores default: água a 20 °C (IAPWS). Para outros fluidos/temperaturas, edite manualmente.</p>
                <p className="text-xs text-muted-foreground mt-1">TODO: tabela IAPWS para interpolação por temperatura</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      {/* Paralelo aviso */}
      {circuito.linhas.length > 1 && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/5 px-4 py-2.5 text-sm text-yellow-500">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Linhas em paralelo não são resolvidas automaticamente (v1 — em série simples).
            Para balanceamento de rede hidráulica paralela, é necessário um solver dedicado.
          </span>
        </div>
      )}

      {/* Linhas */}
      {circuito.linhas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <p className="text-sm text-muted-foreground">Nenhuma linha. Adicione a primeira linha ao circuito.</p>
            {!isReadonly && (
              <Button variant="outline" size="sm" onClick={addLinha} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Adicionar linha
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {circuito.linhas.map((linha, i) => {
            const res = resultado.linhas[i];
            if (!res) return null;
            return (
              <LinhaCard
                key={linha.id}
                linha={linha}
                resultado={res}
                fluido={circuito.fluido}
                readonly={isReadonly}
                onRemoveLinha={() => removeLinha(linha.id)}
                onUpdateLinha={(u) => updateLinha(linha.id, u)}
                onAddElemento={(el) => addElemento(linha.id, el)}
                onRemoveElemento={(id) => removeElemento(linha.id, id)}
                onUpdateElemento={(id, u) => updateElemento(linha.id, id, u)}
              />
            );
          })}

          {!isReadonly && (
            <Button variant="outline" size="sm" onClick={addLinha} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Adicionar linha
            </Button>
          )}
        </div>
      )}

      {/* Circuito summary */}
      {circuito.linhas.length > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-6">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Circuito total</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-mono font-bold">{fmt(resultado.dpTotalBar, 4)}</span>
                <span className="text-sm text-muted-foreground">bar</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono font-semibold">{fmt(resultado.dpTotalMca, 3)}</span>
                <span className="text-sm text-muted-foreground">m.c.a.</span>
              </div>
              <div className="ml-auto text-xs text-muted-foreground italic">
                <InlineMath math={FORMULA_PRINCIPAL} />
              </div>
            </div>

            {circuito.linhas.length > 1 && (
              <div className="mt-2 overflow-x-auto">
                <table className="text-xs w-full mt-1">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left pb-1 font-medium">Linha</th>
                      <th className="text-right pb-1 font-medium">Q [m³/h]</th>
                      <th className="text-right pb-1 font-medium">ΔP [bar]</th>
                      <th className="text-right pb-1 font-medium">m.c.a.</th>
                      <th className="text-right pb-1 font-medium">v_max [m/s]</th>
                    </tr>
                  </thead>
                  <tbody>
                    {circuito.linhas.map((l, i) => {
                      const r = resultado.linhas[i];
                      return (
                        <tr key={l.id} className="border-t border-border/30">
                          <td className="py-0.5 pr-3">{l.nome}</td>
                          <td className="py-0.5 text-right font-mono">{l.vazao}</td>
                          <td className="py-0.5 text-right font-mono font-medium">{r?.bloqueada ? '—' : fmt(r?.dpTotalBar, 4)}</td>
                          <td className="py-0.5 text-right font-mono">{r?.bloqueada ? '—' : fmt(r?.dpTotalMca, 3)}</td>
                          <td className="py-0.5 text-right font-mono">{fmt(r?.velocidadeMax, 2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Premissas */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Premissas / Notas</Label>
        {isReadonly ? (
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{premissas || '—'}</p>
        ) : (
          <textarea
            className="w-full min-h-[80px] text-sm rounded-md border border-input bg-background px-3 py-2 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            value={premissas}
            onChange={(e) => setPremissas(e.target.value)}
            placeholder="Hipóteses adotadas, restrições, notas de projeto…"
          />
        )}
      </div>
    </div>
  );
}

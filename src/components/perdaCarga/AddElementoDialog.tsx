import { useState, useEffect } from 'react';
import { Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

import {
  CATALOG_FITTINGS, CATALOG_RUGOSIDADE,
  type CatalogItemFitting,
} from '@/lib/catalogo';
import { getNPSList, getSchedules, getDNList, getFT } from '@/lib/normasTubulacao';
import {
  useNormativeDiameter,
  type NormativaDefault,
  type NormaOpcao,
  type UseNormativeDiameterReturn,
} from '@/hooks/useNormativeDiameter';
import type { ElementoHidraulico, TipoElemento } from '@/types/perdaCarga';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (el: ElementoHidraulico) => void;
  defaultDimensao?: NormativaDefault;
}

type Categoria = TipoElemento | '';

function parseNum(s: string, fallback = 0): number {
  const v = parseFloat(s.replace(',', '.'));
  return isNaN(v) ? fallback : v;
}

const CONFIANCA_COLOR: Record<string, string> = {
  alta:  'text-green-600',
  media: 'text-yellow-600',
  baixa: 'text-orange-600',
};

function SourceBadge({ item }: { item: CatalogItemFitting }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={item.fonteUrl}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex items-center gap-1 text-xs underline underline-offset-2 ${CONFIANCA_COLOR[item.confianca]}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="h-3 w-3" />
          {item.fonte}
        </a>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">Confiança: {item.confianca}</p>
        {item.nota && <p className="text-xs text-muted-foreground mt-1">{item.nota}</p>}
        <p className="text-xs text-muted-foreground mt-1">Tolerância típica ±25%</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ── Normative selector block ──────────────────────────────────────────────────

interface NormativeSelectorBlockProps {
  norm: UseNormativeDiameterReturn;
  label?: string;
}

function NormativeSelectorBlock({ norm, label }: NormativeSelectorBlockProps) {
  const isASME = norm.norma !== 'DIN_11850';
  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      {label && (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      )}

      <div className="space-y-1.5">
        <Label>Material / Norma</Label>
        <Select value={norm.norma} onValueChange={(v) => norm.handleNormaChange(v as NormaOpcao)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ASME_B36_19M">Inox — ASME B36.19M</SelectItem>
            <SelectItem value="ASME_B36_10M">Aço Carbono — ASME B36.10M</SelectItem>
            <SelectItem value="DIN_11850">Sanitário — DIN 11850</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isASME && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>NPS</Label>
            <Select value={norm.nps} onValueChange={norm.handleNPSChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {getNPSList().map((nps) => (
                  <SelectItem key={nps} value={nps}>{nps}"</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Schedule</Label>
            <Select value={norm.schedule} onValueChange={norm.setSchedule}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {getSchedules(norm.norma as 'ASME_B36_10M' | 'ASME_B36_19M', norm.nps).map((sch) => (
                  <SelectItem key={sch} value={sch}>SCH {sch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {!isASME && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>DN</Label>
            <Select value={norm.dn} onValueChange={norm.setDN}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {getDNList().map((dn) => (
                  <SelectItem key={dn} value={dn}>DN {dn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Série</Label>
            <Select value={norm.serieDin} onValueChange={(v) => norm.setSerieDin(v as '1' | '2')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Série 1 (alimentício)</SelectItem>
                <SelectItem value="2">Série 2 (farmacêutico)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {norm.dimensao && (
        <>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">OD</p>
              <p className="font-mono text-sm">{norm.dimensao.od_mm} mm</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Esp.</p>
              <p className="font-mono text-sm">{norm.dimensao.espessura_mm} mm</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-muted-foreground">ID</p>
              <p className="font-mono text-sm font-semibold">{norm.dimensao.id_mm} mm</p>
            </div>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{norm.dimensao.label}</p>
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AddElementoDialog({ open, onClose, onConfirm, defaultDimensao }: Props) {
  const [categoria, setCategoria] = useState<Categoria>('');
  const [catalogoId, setCatalogoId] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [k, setK] = useState('');

  // normEnt: entrada (or single diameter for trecho/fittings); normSai: saída for reducao
  const normEnt = useNormativeDiameter(defaultDimensao);
  const normSai = useNormativeDiameter(defaultDimensao);

  // ── Trecho fields ────────────────────────────────────────────────────────
  const [material, setMaterial]       = useState(normEnt.suggestedMaterial);
  const [comprimento, setComprimento] = useState('10000');
  const [desnivel, setDesnivel]       = useState('0');
  const [rugosidade, setRugosidade]   = useState(() => {
    const r = CATALOG_RUGOSIDADE.find((r) => r.material === normEnt.suggestedMaterial);
    return String(r?.eps_mm ?? CATALOG_RUGOSIDADE[0].eps_mm);
  });

  // ── Filtro fields ────────────────────────────────────────────────────────
  const [filtroModo, setFiltroModo]           = useState<'k_generico' | 'cv_fabricante'>('k_generico');
  const [filtroK, setFiltroK]                 = useState('2');
  const [filtroCv, setFiltroCv]               = useState('');
  const [filtroCvUnidade, setFiltroCvUnidade] = useState<'SI' | 'US'>('SI');

  // ── Acessório fields ─────────────────────────────────────────────────────
  const [acessorioNome, setAcessorioNome] = useState('');
  const [acessorioK, setAcessorioK]       = useState('1');

  const fittingOptions  = CATALOG_FITTINGS.filter((c) => c.categoria === categoria);
  const selectedFitting = CATALOG_FITTINGS.find((c) => c.id === catalogoId);

  // Suggest material when norma changes (trecho only)
  useEffect(() => {
    setMaterial(normEnt.suggestedMaterial);
  }, [normEnt.suggestedMaterial]);

  // Update rugosidade when material changes
  useEffect(() => {
    const r = CATALOG_RUGOSIDADE.find((r) => r.material === material);
    if (r) setRugosidade(String(r.eps_mm));
  }, [material]);

  // Reset catalogoId + K when categoria changes
  useEffect(() => {
    setCatalogoId('');
    setK('');
  }, [categoria]);

  // Update K when fitting or NPS/norma changes — prefer Crane nCrane × fT when available
  useEffect(() => {
    if (!selectedFitting) return;
    const fT    = normEnt.norma !== 'DIN_11850' ? getFT(normEnt.nps) : null;
    const crane = selectedFitting.nCrane != null && fT != null ? selectedFitting.nCrane * fT : null;
    setK(crane != null ? String(parseFloat(crane.toFixed(4))) : String(selectedFitting.k));
  }, [catalogoId, selectedFitting, normEnt.nps, normEnt.norma]);

  // ── Confirm ──────────────────────────────────────────────────────────────

  function buildNormFields(norm: UseNormativeDiameterReturn) {
    return {
      norma:    norm.norma,
      nps:      norm.norma !== 'DIN_11850' ? norm.nps      : undefined,
      schedule: norm.norma !== 'DIN_11850' ? norm.schedule : undefined,
      dn:       norm.norma === 'DIN_11850' ? norm.dn       : undefined,
      serie_din: norm.norma === 'DIN_11850' ? norm.serieDin : undefined,
      od_mm:        norm.dimensao?.od_mm,
      espessura_mm: norm.dimensao?.espessura_mm,
      label_normativo: norm.dimensao?.label,
    };
  }

  function handleConfirm() {
    const id  = crypto.randomUUID();
    const qtd = parseNum(quantidade, 1);

    if (categoria === 'trecho') {
      if (!normEnt.dimensao) return;
      onConfirm({
        id, tipo: 'trecho',
        material,
        diametro: normEnt.dimensao.id_mm,
        comprimento: parseNum(comprimento, 10000),
        desnivel: parseNum(desnivel, 0),
        rugosidade: parseNum(rugosidade, 0.046),
        quantidade: qtd,
        ...buildNormFields(normEnt),
      });
    } else if (categoria === 'curva') {
      if (!selectedFitting || !normEnt.dimensao) return;
      onConfirm({
        id, tipo: 'curva',
        subtipo: selectedFitting.subtipo,
        label: selectedFitting.label,
        diametro: normEnt.dimensao.id_mm,
        k: parseNum(k, selectedFitting.k),
        quantidade: qtd,
        ...buildNormFields(normEnt),
      });
    } else if (categoria === 'te') {
      if (!selectedFitting || !normEnt.dimensao) return;
      onConfirm({
        id, tipo: 'te',
        subtipo: selectedFitting.subtipo as 'direta' | 'lateral',
        label: selectedFitting.label,
        diametro: normEnt.dimensao.id_mm,
        k: parseNum(k, selectedFitting.k),
        quantidade: qtd,
        ...buildNormFields(normEnt),
      });
    } else if (categoria === 'valvula') {
      if (!selectedFitting || !normEnt.dimensao) return;
      onConfirm({
        id, tipo: 'valvula',
        subtipo: selectedFitting.subtipo,
        label: selectedFitting.label,
        diametro: normEnt.dimensao.id_mm,
        k: parseNum(k, selectedFitting.k),
        quantidade: qtd,
        ...buildNormFields(normEnt),
      });
    } else if (categoria === 'filtro') {
      if (!normEnt.dimensao) return;
      onConfirm({
        id, tipo: 'filtro',
        diametro: normEnt.dimensao.id_mm,
        modo: filtroModo,
        k:  filtroModo === 'k_generico'    ? parseNum(filtroK, 2)        : undefined,
        cv: filtroModo === 'cv_fabricante' ? parseNum(filtroCv, 0) || undefined : undefined,
        cvUnidade: filtroModo === 'cv_fabricante' ? filtroCvUnidade : undefined,
        quantidade: qtd,
        ...buildNormFields(normEnt),
      });
    } else if (categoria === 'acessorio') {
      if (!normEnt.dimensao) return;
      onConfirm({
        id, tipo: 'acessorio',
        nome: selectedFitting?.label || acessorioNome || 'Acessório',
        diametro: normEnt.dimensao.id_mm,
        k: selectedFitting ? parseNum(k, selectedFitting.k) : parseNum(acessorioK, 1),
        quantidade: qtd,
        ...buildNormFields(normEnt),
      });
    } else if (categoria === 'reducao') {
      if (!normEnt.dimensao || !normSai.dimensao) return;
      onConfirm({
        id, tipo: 'reducao',
        diametro_entrada: normEnt.dimensao.id_mm,
        norma_entrada:    normEnt.norma,
        nps_entrada:      normEnt.norma !== 'DIN_11850' ? normEnt.nps      : undefined,
        schedule_entrada: normEnt.norma !== 'DIN_11850' ? normEnt.schedule : undefined,
        dn_entrada:       normEnt.norma === 'DIN_11850' ? normEnt.dn       : undefined,
        serie_din_entrada: normEnt.norma === 'DIN_11850' ? normEnt.serieDin : undefined,
        od_entrada:       normEnt.dimensao.od_mm,
        esp_entrada:      normEnt.dimensao.espessura_mm,
        label_entrada:    normEnt.dimensao.label,
        diametro_saida:   normSai.dimensao.id_mm,
        norma_saida:      normSai.norma,
        nps_saida:        normSai.norma !== 'DIN_11850' ? normSai.nps      : undefined,
        schedule_saida:   normSai.norma !== 'DIN_11850' ? normSai.schedule : undefined,
        dn_saida:         normSai.norma === 'DIN_11850' ? normSai.dn       : undefined,
        serie_din_saida:  normSai.norma === 'DIN_11850' ? normSai.serieDin : undefined,
        od_saida:         normSai.dimensao.od_mm,
        esp_saida:        normSai.dimensao.espessura_mm,
        label_saida:      normSai.dimensao.label,
        quantidade: qtd,
      });
    }

    onClose();
  }

  const canConfirm = (() => {
    if (!categoria) return false;
    if (categoria !== 'reducao' && !normEnt.dimensao) return false;
    if (categoria === 'curva' || categoria === 'te' || categoria === 'valvula') return !!selectedFitting;
    if (categoria === 'reducao') return !!normEnt.dimensao && !!normSai.dimensao;
    return true;
  })();

  // Crane K hint for display
  const kFromCrane: number | null = (() => {
    if (!selectedFitting?.nCrane || normEnt.norma === 'DIN_11850') return null;
    const fT = getFT(normEnt.nps);
    return fT != null ? selectedFitting.nCrane * fT : null;
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar elemento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Categoria */}
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as Categoria)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trecho">Trecho de tubulação</SelectItem>
                <SelectItem value="curva">Curva</SelectItem>
                <SelectItem value="te">Tê</SelectItem>
                <SelectItem value="valvula">Válvula</SelectItem>
                <SelectItem value="filtro">Filtro / strainer</SelectItem>
                <SelectItem value="acessorio">Acessório genérico</SelectItem>
                <SelectItem value="reducao">Redução abrupta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subtipo — curva / tê / válvula */}
          {(categoria === 'curva' || categoria === 'te' || categoria === 'valvula') && (
            <div className="space-y-1.5">
              <Label>Subtipo</Label>
              <Select value={catalogoId} onValueChange={setCatalogoId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {fittingOptions.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedFitting && <SourceBadge item={selectedFitting} />}
            </div>
          )}

          {/* Subtipo — acessório */}
          {categoria === 'acessorio' && (
            <>
              <div className="space-y-1.5">
                <Label>Subtipo (opcional do catálogo)</Label>
                <Select value={catalogoId} onValueChange={setCatalogoId}>
                  <SelectTrigger><SelectValue placeholder="Livre / selecione do catálogo" /></SelectTrigger>
                  <SelectContent>
                    {CATALOG_FITTINGS.filter((c) => c.categoria === 'acessorio').map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedFitting && <SourceBadge item={selectedFitting} />}
              </div>
              {!catalogoId && (
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={acessorioNome} onChange={(e) => setAcessorioNome(e.target.value)} placeholder="ex.: Medidor de vazão" />
                </div>
              )}
            </>
          )}

          {/* Normative diameter selector — all types except reducao */}
          {categoria !== '' && categoria !== 'reducao' && (
            <NormativeSelectorBlock
              norm={normEnt}
              label={categoria === 'trecho' ? 'Diâmetro — Norma' : 'Diâmetro interno — Norma'}
            />
          )}

          {/* Normative diameter — reducao: two selectors */}
          {categoria === 'reducao' && (
            <>
              <NormativeSelectorBlock norm={normEnt} label="Seção de entrada" />
              <NormativeSelectorBlock norm={normSai} label="Seção de saída" />
            </>
          )}

          {/* Quantidade */}
          {categoria !== '' && (
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                type="number" min="1" step="1"
                className="w-24"
              />
            </div>
          )}

          {/* Trecho — material, comprimento, desnivel, rugosidade */}
          {categoria === 'trecho' && (
            <>
              <div className="space-y-1.5">
                <Label>Material (rugosidade)</Label>
                <Select value={material} onValueChange={setMaterial}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATALOG_RUGOSIDADE.map((r) => (
                      <SelectItem key={r.material} value={r.material}>
                        {r.material} — ε = {r.eps_mm} mm
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Comprimento <span className="text-muted-foreground font-normal">[mm]</span></Label>
                  <Input value={comprimento} onChange={(e) => setComprimento(e.target.value)} type="number" min="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Desnível Δz <span className="text-muted-foreground font-normal">[mm]</span></Label>
                  <Input value={desnivel} onChange={(e) => setDesnivel(e.target.value)} type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Rugosidade ε <span className="text-muted-foreground font-normal">[mm]</span></Label>
                  <Input value={rugosidade} onChange={(e) => setRugosidade(e.target.value)} type="number" min="0" step="0.001" />
                </div>
              </div>
            </>
          )}

          {/* K — curva / tê / válvula */}
          {(categoria === 'curva' || categoria === 'te' || categoria === 'valvula') && selectedFitting && (
            <div className="space-y-1.5">
              <Label>K (editável)</Label>
              <div className="flex gap-2 items-center flex-wrap">
                <Input className="w-32" value={k} onChange={(e) => setK(e.target.value)} type="number" min="0" step="0.01" />
                {kFromCrane != null ? (
                  <span className="text-xs text-muted-foreground">
                    Crane: {selectedFitting.nCrane} × f_T({normEnt.nps}") = <span className="font-mono">{kFromCrane.toFixed(4)}</span>
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">padrão: {selectedFitting.k}</span>
                )}
              </div>
            </div>
          )}

          {/* K — acessório */}
          {categoria === 'acessorio' && (
            <div className="space-y-1.5">
              <Label>K</Label>
              <Input
                className="w-32"
                value={catalogoId ? k : acessorioK}
                onChange={(e) => catalogoId ? setK(e.target.value) : setAcessorioK(e.target.value)}
                type="number" min="0" step="0.01"
              />
            </div>
          )}

          {/* Filtro */}
          {categoria === 'filtro' && (
            <>
              <div className="space-y-1.5">
                <Label>Modo</Label>
                <Select value={filtroModo} onValueChange={(v) => setFiltroModo(v as typeof filtroModo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="k_generico">K genérico (placeholder — baixa confiança)</SelectItem>
                    <SelectItem value="cv_fabricante">Cv do fabricante</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filtroModo === 'k_generico' && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label>K</Label>
                    <Badge variant="outline" className="text-orange-600 border-orange-400 text-xs">baixa confiança</Badge>
                  </div>
                  <Input className="w-32" value={filtroK} onChange={(e) => setFiltroK(e.target.value)} type="number" min="0" step="0.1" />
                  <p className="text-xs text-muted-foreground">
                    [Dados Insuficientes] Filtros/strainers têm K altamente variável (−50%/+100%) por fabricante.
                    Forneça a curva Cv do fabricante para maior precisão.
                    Fonte: <a href="https://www.katmarsoftware.com/articles/pipe-fitting-pressure-drop.htm" target="_blank" rel="noreferrer" className="underline">Katmar Software</a>
                  </p>
                </div>
              )}

              {filtroModo === 'cv_fabricante' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Unidade do Cv</Label>
                    <Select value={filtroCvUnidade} onValueChange={(v) => setFiltroCvUnidade(v as 'SI' | 'US')}>
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SI">SI — m³/h / √bar</SelectItem>
                        <SelectItem value="US">US — gpm / √psi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Valor Cv</Label>
                    <Input className="w-40" value={filtroCv} onChange={(e) => setFiltroCv(e.target.value)} type="number" min="0" step="0.1" placeholder="ex.: 20" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

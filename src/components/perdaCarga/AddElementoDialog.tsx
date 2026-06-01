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
  CATALOG_FITTINGS, CATALOG_RUGOSIDADE, FLUIDO_AGUA_20C,
  type CatalogItemFitting,
} from '@/lib/catalogo';
import {
  getNPSList, getSchedules, getDefaultSchedule,
  getDimensaoASME, getDNList, getDimensaoDIN11850,
  type DimensaoTubulacao,
} from '@/lib/normasTubulacao';
import type { ElementoHidraulico, TipoElemento } from '@/types/perdaCarga';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (el: ElementoHidraulico) => void;
}

type Categoria = TipoElemento | '';
type NormaOpcao = 'ASME_B36_19M' | 'ASME_B36_10M' | 'DIN_11850';

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

const DEFAULT_NPS = '2';
const DEFAULT_DN  = '50';

export default function AddElementoDialog({ open, onClose, onConfirm }: Props) {
  const [categoria, setCategoria] = useState<Categoria>('');
  const [catalogoId, setCatalogoId] = useState('');
  const [diametro, setDiametro] = useState('50');
  const [quantidade, setQuantidade] = useState('1');
  const [k, setK] = useState('');

  // ── Trecho — dimensionamento normativo ──────────────────────────────────────
  const [trechoNorma, setTrechoNorma]       = useState<NormaOpcao>('ASME_B36_19M');
  const [trechoNPS, setTrechoNPS]           = useState(DEFAULT_NPS);
  const [trechoSchedule, setTrechoSchedule] = useState(getDefaultSchedule('ASME_B36_19M'));
  const [trechoDN, setTrechoDN]             = useState(DEFAULT_DN);
  const [trechoDINSerie, setTrechoDINSerie] = useState<'1' | '2'>('1');

  // ── Trecho — outras propriedades ────────────────────────────────────────────
  const [material, setMaterial]     = useState(CATALOG_RUGOSIDADE[1].material); // Aço inoxidável
  const [comprimento, setComprimento] = useState('10000');
  const [desnivel, setDesnivel]     = useState('0');
  const [rugosidade, setRugosidade] = useState(String(CATALOG_RUGOSIDADE[1].eps_mm));

  // ── Filtro ──────────────────────────────────────────────────────────────────
  const [filtroModo, setFiltroModo] = useState<'k_generico' | 'cv_fabricante'>('k_generico');
  const [filtroK, setFiltroK]       = useState('2');
  const [filtroCv, setFiltroCv]     = useState('');
  const [filtroCvUnidade, setFiltroCvUnidade] = useState<'SI' | 'US'>('SI');

  // ── Acessório ───────────────────────────────────────────────────────────────
  const [acessorioNome, setAcessorioNome] = useState('');
  const [acessorioK, setAcessorioK]       = useState('1');

  // ── Dimensão derivada do trecho ─────────────────────────────────────────────
  const dimensaoTrecho: DimensaoTubulacao | null = (() => {
    if (trechoNorma === 'DIN_11850') {
      return getDimensaoDIN11850(trechoDN, trechoDINSerie);
    }
    return getDimensaoASME(trechoNorma, trechoNPS, trechoSchedule);
  })();

  const fittingOptions = CATALOG_FITTINGS.filter((c) => c.categoria === categoria);
  const selectedFitting = CATALOG_FITTINGS.find((c) => c.id === catalogoId);

  // Atualiza K ao trocar item do catálogo
  useEffect(() => {
    if (selectedFitting) setK(String(selectedFitting.k));
  }, [catalogoId, selectedFitting]);

  // Reseta subtipo ao trocar categoria
  useEffect(() => {
    setCatalogoId('');
    setK('');
  }, [categoria]);

  // Atualiza rugosidade ao trocar material
  useEffect(() => {
    const r = CATALOG_RUGOSIDADE.find((r) => r.material === material);
    if (r) setRugosidade(String(r.eps_mm));
  }, [material]);

  // Ajusta material sugerido ao trocar norma do trecho
  useEffect(() => {
    if (trechoNorma === 'ASME_B36_19M' || trechoNorma === 'DIN_11850') {
      const inox = CATALOG_RUGOSIDADE.find((r) => r.material === 'Aço inoxidável');
      if (inox) setMaterial(inox.material);
    } else {
      const aco = CATALOG_RUGOSIDADE.find((r) => r.material === 'Aço comercial novo');
      if (aco) setMaterial(aco.material);
    }
  }, [trechoNorma]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleNormaChange(norma: NormaOpcao) {
    setTrechoNorma(norma);
    if (norma !== 'DIN_11850') {
      setTrechoNPS(DEFAULT_NPS);
      setTrechoSchedule(getDefaultSchedule(norma));
    } else {
      setTrechoDN(DEFAULT_DN);
      setTrechoDINSerie('1');
    }
  }

  function handleNPSChange(nps: string) {
    setTrechoNPS(nps);
    // Se o schedule atual não existe para o novo NPS, volta ao default
    const available = getSchedules(trechoNorma as 'ASME_B36_10M' | 'ASME_B36_19M', nps);
    if (!available.includes(trechoSchedule)) {
      setTrechoSchedule(getDefaultSchedule(trechoNorma as 'ASME_B36_10M' | 'ASME_B36_19M'));
    }
  }

  function handleConfirm() {
    const id = crypto.randomUUID();
    const qtd = parseNum(quantidade, 1);
    const D = parseNum(diametro, 50);

    if (categoria === 'trecho') {
      if (!dimensaoTrecho) return;
      onConfirm({
        id, tipo: 'trecho',
        material,
        diametro: dimensaoTrecho.id_mm, // ID = OD − 2×t
        comprimento: parseNum(comprimento, 10000),
        desnivel: parseNum(desnivel, 0),
        rugosidade: parseNum(rugosidade, 0.046),
        quantidade: qtd,
        norma: trechoNorma,
        nps: trechoNorma !== 'DIN_11850' ? trechoNPS : undefined,
        schedule: trechoNorma !== 'DIN_11850' ? trechoSchedule : undefined,
        dn: trechoNorma === 'DIN_11850' ? trechoDN : undefined,
        serie_din: trechoNorma === 'DIN_11850' ? trechoDINSerie : undefined,
        od_mm: dimensaoTrecho.od_mm,
        espessura_mm: dimensaoTrecho.espessura_mm,
        label_normativo: dimensaoTrecho.label,
      });
    } else if (categoria === 'curva') {
      if (!selectedFitting) return;
      onConfirm({
        id, tipo: 'curva',
        subtipo: selectedFitting.subtipo,
        label: selectedFitting.label,
        diametro: D,
        k: parseNum(k, selectedFitting.k),
        quantidade: qtd,
      });
    } else if (categoria === 'te') {
      if (!selectedFitting) return;
      onConfirm({
        id, tipo: 'te',
        subtipo: selectedFitting.subtipo as 'direta' | 'lateral',
        label: selectedFitting.label,
        diametro: D,
        k: parseNum(k, selectedFitting.k),
        quantidade: qtd,
      });
    } else if (categoria === 'valvula') {
      if (!selectedFitting) return;
      onConfirm({
        id, tipo: 'valvula',
        subtipo: selectedFitting.subtipo,
        label: selectedFitting.label,
        diametro: D,
        k: parseNum(k, selectedFitting.k),
        quantidade: qtd,
      });
    } else if (categoria === 'filtro') {
      onConfirm({
        id, tipo: 'filtro',
        diametro: D,
        modo: filtroModo,
        k: filtroModo === 'k_generico' ? parseNum(filtroK, 2) : undefined,
        cv: filtroModo === 'cv_fabricante' ? parseNum(filtroCv, 0) || undefined : undefined,
        cvUnidade: filtroModo === 'cv_fabricante' ? filtroCvUnidade : undefined,
        quantidade: qtd,
      });
    } else if (categoria === 'acessorio') {
      onConfirm({
        id, tipo: 'acessorio',
        nome: acessorioNome || 'Acessório',
        diametro: D,
        k: selectedFitting ? parseNum(k, selectedFitting.k) : parseNum(acessorioK, 1),
        quantidade: qtd,
      });
    }

    onClose();
  }

  const canConfirm =
    (categoria === 'trecho' && dimensaoTrecho !== null) ||
    categoria === 'filtro' ||
    (categoria === 'acessorio') ||
    (!!selectedFitting && !!catalogoId);

  const isASME = trechoNorma !== 'DIN_11850';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
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

          {/* Diâmetro + Quantidade — não-trecho */}
          {categoria !== '' && categoria !== 'trecho' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Diâmetro interno D <span className="text-muted-foreground font-normal">[mm]</span></Label>
                <Input value={diametro} onChange={(e) => setDiametro(e.target.value)} type="number" min="0.1" />
              </div>
              <div className="space-y-1.5">
                <Label>Quantidade</Label>
                <Input value={quantidade} onChange={(e) => setQuantidade(e.target.value)} type="number" min="1" step="1" />
              </div>
            </div>
          )}

          {/* ── Trecho ── */}
          {categoria === 'trecho' && (
            <>
              {/* Seletor normativo de diâmetro */}
              <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Diâmetro — Norma
                </p>

                {/* Material / Norma */}
                <div className="space-y-1.5">
                  <Label>Material / Norma</Label>
                  <Select value={trechoNorma} onValueChange={(v) => handleNormaChange(v as NormaOpcao)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ASME_B36_19M">Inox — ASME B36.19M</SelectItem>
                      <SelectItem value="ASME_B36_10M">Aço Carbono — ASME B36.10M</SelectItem>
                      <SelectItem value="DIN_11850">Sanitário — DIN 11850</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* ASME: NPS + Schedule */}
                {isASME && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>NPS</Label>
                      <Select value={trechoNPS} onValueChange={handleNPSChange}>
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
                      <Select
                        value={trechoSchedule}
                        onValueChange={setTrechoSchedule}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {getSchedules(trechoNorma as 'ASME_B36_10M' | 'ASME_B36_19M', trechoNPS).map((sch) => (
                            <SelectItem key={sch} value={sch}>SCH {sch}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* DIN 11850: DN + Série */}
                {!isASME && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>DN</Label>
                      <Select value={trechoDN} onValueChange={setTrechoDN}>
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
                      <Select
                        value={trechoDINSerie}
                        onValueChange={(v) => setTrechoDINSerie(v as '1' | '2')}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Série 1 (alimentício)</SelectItem>
                          <SelectItem value="2">Série 2 (farmacêutico)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Dimensões derivadas — somente leitura */}
                {dimensaoTrecho && (
                  <>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">OD</p>
                        <p className="font-mono text-sm">{dimensaoTrecho.od_mm} mm</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Esp.</p>
                        <p className="font-mono text-sm">{dimensaoTrecho.espessura_mm} mm</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-muted-foreground">ID</p>
                        <p className="font-mono text-sm font-semibold">{dimensaoTrecho.id_mm} mm</p>
                      </div>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">{dimensaoTrecho.label}</p>
                  </>
                )}
              </div>

              {/* Quantidade */}
              <div className="space-y-1.5">
                <Label>Quantidade</Label>
                <Input
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  type="number" min="1" step="1"
                  className="w-24"
                />
              </div>

              {/* Material (rugosidade) */}
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

              {/* Comprimento, desnível, rugosidade */}
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
              <div className="flex gap-2 items-center">
                <Input className="w-32" value={k} onChange={(e) => setK(e.target.value)} type="number" min="0" step="0.01" />
                <span className="text-sm text-muted-foreground">padrão: {selectedFitting.k}</span>
              </div>
            </div>
          )}

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

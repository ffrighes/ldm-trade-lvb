import type {
  CircuitoHidraulico,
  LinhaHidraulica,
  ElementoHidraulico,
  FluidoProps,
  TrechoTubo,
  FiltroFitting,
  ResultadoCircuito,
  ResultadoLinha,
  ResultadoElemento,
  RegiaoFluxo,
} from '@/types/perdaCarga';

export const G = 9.80665; // m/s²
export const PA_TO_BAR = 1e-5;

// ── Primitives ────────────────────────────────────────────────────────────────

export function calcArea(D_mm: number): number {
  const D = D_mm / 1000;
  return Math.PI * D * D / 4;
}

export function calcVelocidade(Q_m3h: number, D_mm: number): number {
  if (D_mm <= 0 || Q_m3h <= 0) return 0;
  return (Q_m3h / 3600) / calcArea(D_mm);
}

export function calcReynolds(v: number, D_mm: number, nu: number): number {
  if (nu <= 0 || D_mm <= 0) return 0;
  return v * (D_mm / 1000) / nu;
}

export function calcFatorAtrito(
  Re: number,
  eps_mm: number,
  D_mm: number,
): { f: number; regiao: RegiaoFluxo } {
  if (Re <= 0) return { f: 0, regiao: 'laminar' };

  if (Re < 2300) {
    return { f: 64 / Re, regiao: 'laminar' };
  }

  function swameeJain(re: number): number {
    const epsR  = (eps_mm / D_mm) / 3.7;
    const epsRe = 5.74 / Math.pow(re, 0.9);
    return 0.25 / Math.pow(Math.log10(epsR + epsRe), 2);
  }

  if (Re >= 4000) {
    return { f: swameeJain(Re), regiao: 'turbulento' };
  }

  // Transition: linear interpolation between laminar at Re=2300 and turbulent at Re=4000
  const f_lam  = 64 / 2300;
  const f_turb = swameeJain(4000);
  const t = (Re - 2300) / (4000 - 2300);
  return { f: f_lam + t * (f_turb - f_lam), regiao: 'transicao' };
}

export function calcPerdaAtritoPa(
  f: number,
  L_mm: number,
  D_mm: number,
  rho: number,
  v: number,
): number {
  if (D_mm <= 0) return 0;
  return f * (L_mm / D_mm) * (rho * v * v / 2);
}

export function calcPerdaLocalizadaPa(
  K: number,
  rho: number,
  v: number,
  qtd = 1,
): number {
  return qtd * K * (rho * v * v / 2);
}

export function calcPerdaElevacaoPa(Dz_mm: number, rho: number): number {
  return rho * G * (Dz_mm / 1000);
}

function viscCinematica(fluido: FluidoProps): number {
  return fluido.viscDinamica / fluido.densidade;
}

function paToBare(pa: number): number {
  return pa * PA_TO_BAR;
}

function paToMca(pa: number, rho: number): number {
  return pa / (rho * G);
}

// ── Element calculation ───────────────────────────────────────────────────────

function calcElemento(
  el: ElementoHidraulico,
  Q_m3h: number,
  fluido: FluidoProps,
): ResultadoElemento {
  const base: ResultadoElemento = {
    elementoId: el.id,
    velocidade: null,
    reynolds: null,
    fatorAtrito: null,
    regiao: null,
    dpBar: null,
    dpMca: null,
    contribuicaoPct: null,
  };

  if (Q_m3h <= 0) {
    return { ...base, erro: 'Informe a vazão' };
  }

  if (el.tipo === 'trecho') {
    const t = el as TrechoTubo;
    if (t.diametro <= 0) return { ...base, erro: 'Diâmetro = 0 — inválido' };

    const v   = calcVelocidade(Q_m3h, t.diametro);
    const nu  = viscCinematica(fluido);
    const Re  = calcReynolds(v, t.diametro, nu);
    const { f, regiao } = calcFatorAtrito(Re, t.rugosidade, t.diametro);
    const dpAtrito_Pa = calcPerdaAtritoPa(f, t.comprimento, t.diametro, fluido.densidade, v);
    const dpElev_Pa   = calcPerdaElevacaoPa(t.desnivel, fluido.densidade);
    const dpTotal_Pa  = (dpAtrito_Pa + dpElev_Pa) * t.quantidade;

    const avisos: string[] = [];
    if (v > 3)            avisos.push(`Velocidade ${v.toFixed(2)} m/s acima de 3 m/s (faixa típica para água)`);
    if (regiao === 'transicao') avisos.push('Regime de transição — resultado aproximado');

    return {
      ...base,
      velocidade: v,
      reynolds:   Re,
      fatorAtrito: f,
      regiao,
      dpBar: paToBare(dpTotal_Pa),
      dpMca: paToMca(dpTotal_Pa, fluido.densidade),
      aviso: avisos.join(' | ') || undefined,
    };
  }

  if (el.tipo === 'filtro') {
    const f = el as FiltroFitting;
    if (f.diametro <= 0) return { ...base, erro: 'Diâmetro = 0 — inválido' };

    const v  = calcVelocidade(Q_m3h, f.diametro);
    const nu = viscCinematica(fluido);
    const Re = calcReynolds(v, f.diametro, nu);

    if (f.modo === 'cv_fabricante') {
      if (f.cv == null || f.cv <= 0) {
        return { ...base, erro: '[Dados Insuficientes] Filtro sem dados do fabricante — valor bloqueado' };
      }
      let dp_bar: number;
      if (f.cvUnidade === 'US') {
        // Cv_US: Q[gpm] / √ΔP[psi]   →   ΔP[bar] = (Q[gpm]/Cv)² / 14.5038
        const Q_gpm = Q_m3h * 4.40287;
        dp_bar = Math.pow(Q_gpm / f.cv, 2) / 14.5038;
      } else {
        // Cv_SI: Q[m³/h] / √ΔP[bar]  →   ΔP[bar] = (Q/Cv)²
        dp_bar = Math.pow(Q_m3h / f.cv, 2);
      }
      const dpTotal_bar = dp_bar * f.quantidade;
      const dpTotal_Pa  = dpTotal_bar / PA_TO_BAR;
      return {
        ...base,
        velocidade: v,
        reynolds:   Re,
        dpBar: dpTotal_bar,
        dpMca: paToMca(dpTotal_Pa, fluido.densidade),
      };
    }

    // k_generico
    const K = f.k ?? 2.0;
    const dpPa = calcPerdaLocalizadaPa(K, fluido.densidade, v, f.quantidade);
    return {
      ...base,
      velocidade: v,
      reynolds:   Re,
      dpBar: paToBare(dpPa),
      dpMca: paToMca(dpPa, fluido.densidade),
      aviso: '[Dados Insuficientes] K de filtro sem curva do fabricante — baixa confiança',
    };
  }

  // curva | te | valvula | acessorio — método K
  const elAny = el as { diametro: number; k: number };
  if (elAny.diametro <= 0) return { ...base, erro: 'Diâmetro = 0 — inválido' };

  const v   = calcVelocidade(Q_m3h, elAny.diametro);
  const nu  = viscCinematica(fluido);
  const Re  = calcReynolds(v, elAny.diametro, nu);
  const dpPa = calcPerdaLocalizadaPa(elAny.k, fluido.densidade, v, el.quantidade);

  return {
    ...base,
    velocidade: v,
    reynolds:   Re,
    dpBar: paToBare(dpPa),
    dpMca: paToMca(dpPa, fluido.densidade),
    aviso: v > 3 ? `Velocidade ${v.toFixed(2)} m/s acima de 3 m/s` : undefined,
  };
}

// ── Line calculation ──────────────────────────────────────────────────────────

export function calcLinha(linha: LinhaHidraulica, fluido: FluidoProps): ResultadoLinha {
  const resultados: ResultadoElemento[] = linha.elementos.map((el) =>
    calcElemento(el, linha.vazao, fluido),
  );

  const bloqueada = resultados.some((r) => r.erro != null);

  let dpTotalBar = 0;
  if (!bloqueada) {
    for (const r of resultados) {
      dpTotalBar += r.dpBar ?? 0;
    }
  }

  // Contribution percentages (only when total > 0 and not blocked)
  if (!bloqueada && dpTotalBar !== 0) {
    for (const r of resultados) {
      r.contribuicaoPct = dpTotalBar !== 0 ? ((r.dpBar ?? 0) / dpTotalBar) * 100 : null;
    }
  }

  const velocidadeMax = resultados.reduce(
    (max, r) => (r.velocidade != null && r.velocidade > max ? r.velocidade : max),
    0,
  );

  const avisos: string[] = [];
  for (const r of resultados) {
    if (r.aviso) avisos.push(r.aviso);
  }
  if (bloqueada) {
    avisos.push('Linha bloqueada — um ou mais elementos sem dados suficientes');
  }

  const dpTotalPa  = dpTotalBar / PA_TO_BAR;
  const dpTotalMca = bloqueada ? 0 : paToMca(dpTotalPa, fluido.densidade);

  return {
    linhaId: linha.id,
    dpTotalBar,
    dpTotalMca,
    velocidadeMax,
    bloqueada,
    elementos: resultados,
    avisos,
  };
}

// ── Circuit calculation ───────────────────────────────────────────────────────

export function calcCircuito(circuito: CircuitoHidraulico): ResultadoCircuito {
  const linhas = circuito.linhas.map((l) => calcLinha(l, circuito.fluido));
  const dpTotalBar = linhas.reduce((sum, l) => sum + l.dpTotalBar, 0);
  const dpTotalPa  = dpTotalBar / PA_TO_BAR;
  const dpTotalMca = dpTotalPa / (circuito.fluido.densidade * G);
  return { dpTotalBar, dpTotalMca, linhas };
}

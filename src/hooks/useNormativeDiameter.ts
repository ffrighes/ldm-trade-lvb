import { useState } from 'react';
import {
  getNPSList, getSchedules, getDefaultSchedule,
  getDimensaoASME, getDNList, getDimensaoDIN11850,
  type DimensaoTubulacao,
} from '@/lib/normasTubulacao';
import { CATALOG_RUGOSIDADE } from '@/lib/catalogo';

export type NormaOpcao = 'ASME_B36_19M' | 'ASME_B36_10M' | 'DIN_11850';

/** Dados de norma a serem usados como padrão inicial (herdado da linha). */
export interface NormativaDefault {
  norma: NormaOpcao;
  nps?: string;
  schedule?: string;
  dn?: string;
  serie_din?: '1' | '2';
}

export interface UseNormativeDiameterReturn {
  norma: NormaOpcao;
  nps: string;
  schedule: string;
  dn: string;
  serieDin: '1' | '2';
  dimensao: DimensaoTubulacao | null;
  suggestedMaterial: string;
  handleNormaChange: (n: NormaOpcao) => void;
  handleNPSChange: (nps: string) => void;
  setSchedule: (s: string) => void;
  setDN: (dn: string) => void;
  setSerieDin: (s: '1' | '2') => void;
}

const DEFAULT_NPS = '2';
const DEFAULT_DN  = '50';

export function useNormativeDiameter(
  defaultDimensao?: NormativaDefault,
): UseNormativeDiameterReturn {
  const initNorma    = defaultDimensao?.norma ?? 'ASME_B36_19M';
  const initIsASME   = initNorma !== 'DIN_11850';
  const initNPS      = defaultDimensao?.nps ?? DEFAULT_NPS;
  const initSchedule = defaultDimensao?.schedule
    ?? (initIsASME ? getDefaultSchedule(initNorma as 'ASME_B36_10M' | 'ASME_B36_19M') : '10S');
  const initDN       = defaultDimensao?.dn ?? DEFAULT_DN;
  const initSerie    = defaultDimensao?.serie_din ?? '1';

  const [norma,     setNorma]     = useState<NormaOpcao>(initNorma);
  const [nps,       setNPS]       = useState(initNPS);
  const [schedule,  setSchedule]  = useState(initSchedule);
  const [dn,        setDN]        = useState(initDN);
  const [serieDin,  setSerieDin]  = useState<'1' | '2'>(initSerie);

  // Dimensão derivada — calculada na renderização (sem useMemo para evitar dep extra)
  const dimensao: DimensaoTubulacao | null =
    norma === 'DIN_11850'
      ? getDimensaoDIN11850(dn, serieDin)
      : getDimensaoASME(norma, nps, schedule);

  // Material de rugosidade sugerido com base na norma
  const suggestedMaterial =
    norma === 'ASME_B36_19M' || norma === 'DIN_11850'
      ? (CATALOG_RUGOSIDADE.find(r => r.material === 'Aço inoxidável')?.material
          ?? CATALOG_RUGOSIDADE[0].material)
      : (CATALOG_RUGOSIDADE.find(r => r.material === 'Aço comercial novo')?.material
          ?? CATALOG_RUGOSIDADE[0].material);

  function handleNormaChange(n: NormaOpcao) {
    setNorma(n);
    if (n !== 'DIN_11850') {
      setNPS(DEFAULT_NPS);
      setSchedule(getDefaultSchedule(n));
    } else {
      setDN(DEFAULT_DN);
      setSerieDin('1');
    }
  }

  function handleNPSChange(newNPS: string) {
    setNPS(newNPS);
    const available = getSchedules(norma as 'ASME_B36_10M' | 'ASME_B36_19M', newNPS);
    if (!available.includes(schedule)) {
      setSchedule(getDefaultSchedule(norma as 'ASME_B36_10M' | 'ASME_B36_19M'));
    }
  }

  return {
    norma, nps, schedule, dn, serieDin,
    dimensao, suggestedMaterial,
    handleNormaChange, handleNPSChange,
    setSchedule, setDN, setSerieDin,
  };
}

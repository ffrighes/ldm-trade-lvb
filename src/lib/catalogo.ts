import type { Confianca, FluidoProps } from '@/types/perdaCarga';

export interface CatalogItemFitting {
  id: string;
  categoria: 'curva' | 'te' | 'valvula' | 'acessorio';
  subtipo: string;
  label: string;
  k: number;        // K estático (fallback quando NPS não definido)
  nCrane?: number;  // Multiplicador Crane TP-410: K_efetivo = nCrane × f_T(NPS)
  confianca: Confianca;
  fonte: string;
  fonteUrl: string;
  nota?: string;
}

export interface CatalogItemRugosidade {
  material: string;
  eps_mm: number;
  faixa?: string;
  confianca: Confianca;
  fonte: string;
  fonteUrl: string;
}

export const FLUIDO_AGUA_20C: FluidoProps = {
  nome: 'Água',
  densidade: 998.2,
  viscDinamica: 1.002e-3,
  temperatura: 20,
};

const NEUTRIUM_URL = 'https://neutrium.net/articles/fluid-flow/pressure-loss-from-fittings-excess-head-k-method/';
const PURDUE_URL   = 'https://engineering.purdue.edu/~wassgren/teaching/ME30800/NotesAndReading/PipeFlows_Losses_LectureNotes.pdf';
const ANSYS_URL    = 'https://innovationspace.ansys.com/courses/wp-content/uploads/sites/5/2020/09/Lesson-4-Minor-Losses-in-Pipes-and-Ducts-Handout.pdf';

export const CATALOG_FITTINGS: CatalogItemFitting[] = [
  // ── Curvas ──────────────────────────────────────────────────────────────────
  // nCrane: K = nCrane × f_T(NPS) — Crane TP-410, Tabela A-26
  { id: 'curva-45-padrao',   categoria: 'curva', subtipo: 'curva_45_padrao',   label: 'Curva 45° padrão (R/D=1)',        k: 0.35, nCrane: 16, confianca: 'alta',  fonte: 'Neutrium (Crane TP-410)', fonteUrl: NEUTRIUM_URL },
  { id: 'curva-45-longo',    categoria: 'curva', subtipo: 'curva_45_longo',    label: 'Curva 45° raio longo (R/D=1,5)', k: 0.20, nCrane:  8, confianca: 'alta',  fonte: 'Neutrium (Crane TP-410)', fonteUrl: NEUTRIUM_URL },
  { id: 'curva-90-padrao',   categoria: 'curva', subtipo: 'curva_90_padrao',   label: 'Curva 90° padrão (R/D=1)',        k: 0.75, nCrane: 30, confianca: 'alta',  fonte: 'Neutrium (Crane TP-410)', fonteUrl: NEUTRIUM_URL },
  { id: 'curva-90-longo',    categoria: 'curva', subtipo: 'curva_90_longo',    label: 'Curva 90° raio longo (R/D=1,5)', k: 0.45, nCrane: 16, confianca: 'alta',  fonte: 'Neutrium (Crane TP-410)', fonteUrl: NEUTRIUM_URL },
  { id: 'curva-90-mitra',    categoria: 'curva', subtipo: 'curva_90_mitra',    label: 'Curva 90° esquadro / mitra',      k: 1.30,             confianca: 'media', fonte: 'Neutrium (Crane TP-410)', fonteUrl: NEUTRIUM_URL, nota: 'K varia com número de cortes — nCrane não definido; usar K estático' },
  { id: 'curva-180',         categoria: 'curva', subtipo: 'curva_180',         label: 'Curva retorno 180°',              k: 1.50, nCrane: 50, confianca: 'media', fonte: 'Neutrium (Crane TP-410)', fonteUrl: NEUTRIUM_URL },
  // ── Tês ─────────────────────────────────────────────────────────────────────
  { id: 'te-direta',  categoria: 'te', subtipo: 'direta',  label: 'Tê — passagem direta (run)',   k: 0.40, nCrane: 20, confianca: 'media', fonte: 'Neutrium (Crane TP-410)', fonteUrl: NEUTRIUM_URL },
  { id: 'te-lateral', categoria: 'te', subtipo: 'lateral', label: 'Tê — saída lateral (branch)', k: 1.00, nCrane: 60, confianca: 'media', fonte: 'Neutrium (Crane TP-410)', fonteUrl: NEUTRIUM_URL },
  // ── Válvulas ─────────────────────────────────────────────────────────────────
  { id: 'valv-borboleta',        categoria: 'valvula', subtipo: 'borboleta',        label: 'Válvula borboleta — totalmente aberta',     k: 0.86, nCrane: 45,  confianca: 'baixa', fonte: 'Crane TP-410 / Neutrium', fonteUrl: NEUTRIUM_URL, nota: 'K = 45 × f_T; varia com DN e fabricante. K estático ref. NPS 2".' },
  { id: 'valv-esfera-aberta',    categoria: 'valvula', subtipo: 'esfera_aberta',    label: 'Válvula esfera — aberta',                   k: 0.05, nCrane:  3,  confianca: 'alta',  fonte: 'Purdue / ANSYS',          fonteUrl: PURDUE_URL },
  { id: 'valv-globo-aberta',     categoria: 'valvula', subtipo: 'globo_aberta',     label: 'Válvula globo — aberta',                    k: 6.00, nCrane: 340, confianca: 'media', fonte: 'Neutrium / Purdue',       fonteUrl: NEUTRIUM_URL, nota: 'Livros-texto citam K ≈ 10; Crane TP-410 = 340 × f_T' },
  { id: 'valv-retencao-swing',   categoria: 'valvula', subtipo: 'retencao_swing',   label: 'Válvula retenção — portinhola (swing)',      k: 2.00, nCrane: 100, confianca: 'media', fonte: 'Neutrium (Crane TP-410)', fonteUrl: NEUTRIUM_URL },
  { id: 'valv-retencao-disco',   categoria: 'valvula', subtipo: 'retencao_disco',   label: 'Válvula retenção — disco',                  k: 10.0,             confianca: 'media', fonte: 'Neutrium (Crane TP-410)', fonteUrl: NEUTRIUM_URL, nota: '[Dados Insuficientes] nCrane não definido para retencao-disco; K estático' },
  // ── Acessórios ───────────────────────────────────────────────────────────────
  { id: 'uniao-luva',          categoria: 'acessorio', subtipo: 'uniao_luva',          label: 'União / luva',                k: 0.04, confianca: 'media', fonte: 'Neutrium (Crane TP-410)', fonteUrl: NEUTRIUM_URL },
  { id: 'entrada-borda-viva',  categoria: 'acessorio', subtipo: 'entrada_borda_viva',  label: 'Entrada — borda viva',        k: 0.50, confianca: 'alta',  fonte: 'ANSYS / Purdue',          fonteUrl: ANSYS_URL },
  { id: 'entrada-arredondada', categoria: 'acessorio', subtipo: 'entrada_arredondada', label: 'Entrada — arredondada',       k: 0.20, confianca: 'media', fonte: 'ANSYS',                   fonteUrl: ANSYS_URL },
  { id: 'saida-reservatorio',  categoria: 'acessorio', subtipo: 'saida_reservatorio',  label: 'Saída para reservatório',     k: 1.00, confianca: 'alta',  fonte: 'ANSYS',                   fonteUrl: ANSYS_URL },
  { id: 'medidor-disco',       categoria: 'acessorio', subtipo: 'medidor_disco',       label: 'Medidor de água — tipo disco', k: 7.00, confianca: 'baixa', fonte: 'Neutrium (Crane TP-410)', fonteUrl: NEUTRIUM_URL },
];

export const CATALOG_RUGOSIDADE: CatalogItemRugosidade[] = [
  { material: 'Aço comercial novo',     eps_mm: 0.046,  faixa: '0,045–0,09 mm',  confianca: 'alta',  fonte: 'EngineerExcel',           fonteUrl: 'https://engineerexcel.com/pipe-roughness/' },
  { material: 'Aço inoxidável',         eps_mm: 0.015,                            confianca: 'media', fonte: 'studylib (compilação)',    fonteUrl: 'https://studylib.net/doc/pipe-roughness' },
  { material: 'Cobre / latão estirado', eps_mm: 0.0015,                           confianca: 'alta',  fonte: 'MoodyChartCalc',          fonteUrl: 'https://moodychartcalc.com/blog/pipe-roughness-guide/' },
  { material: 'PVC / CPVC / plástico',  eps_mm: 0.0015,                           confianca: 'alta',  fonte: 'EnggCyclopedia',          fonteUrl: 'https://enggcyclopedia.com/2011/09/absolute-roughness/' },
  { material: 'PEAD (HDPE) / PEX',      eps_mm: 0.0015,                           confianca: 'media', fonte: 'MoodyChartCalc',          fonteUrl: 'https://moodychartcalc.com/blog/pipe-roughness-guide/' },
  { material: 'Aço galvanizado',        eps_mm: 0.15,                             confianca: 'media', fonte: 'studylib (compilação)',    fonteUrl: 'https://studylib.net/doc/pipe-roughness' },
  { material: 'Ferro fundido novo',     eps_mm: 0.26,   faixa: '0,25–0,8 mm',   confianca: 'media', fonte: 'studylib (compilação)',    fonteUrl: 'https://studylib.net/doc/pipe-roughness' },
  { material: 'Ferro fundido asfaltado',eps_mm: 0.012,                            confianca: 'media', fonte: 'studylib (compilação)',    fonteUrl: 'https://studylib.net/doc/pipe-roughness' },
  { material: 'Concreto',               eps_mm: 0.3,    faixa: '0,3–3,0 mm',    confianca: 'baixa', fonte: 'studylib (compilação)',    fonteUrl: 'https://studylib.net/doc/pipe-roughness' },
];

export function getCatalogFittingById(id: string): CatalogItemFitting | undefined {
  return CATALOG_FITTINGS.find((c) => c.id === id);
}

export function getCatalogRugosidade(material: string): CatalogItemRugosidade | undefined {
  return CATALOG_RUGOSIDADE.find((r) => r.material === material);
}

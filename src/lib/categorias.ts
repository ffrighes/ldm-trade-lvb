export const CATEGORIAS_MATERIAL = [
  'Tubulação',
  'Conexões',
  'Válvulas',
  'Fixadores',
  'Instrumentos',
] as const;

export type CategoriaMaterial = (typeof CATEGORIAS_MATERIAL)[number];

export const SEM_CATEGORIA_LABEL = 'Sem categoria';

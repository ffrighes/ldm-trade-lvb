// Default categories used as a fallback when the dynamic list from
// `material_categorias` hasn't loaded yet. The catalog is editable in
// the database — see `useCategorias` for the live source of truth.
export const DEFAULT_CATEGORIAS_MATERIAL = [
  'Tubulação',
  'Conexões',
  'Válvulas',
  'Fixadores',
  'Instrumentos',
] as const;

// Kept as alias for backwards compatibility.
export const CATEGORIAS_MATERIAL = DEFAULT_CATEGORIAS_MATERIAL;

export type CategoriaMaterial = string;

export const SEM_CATEGORIA_LABEL = 'Sem categoria';

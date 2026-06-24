import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Estado de UI persistido da página Base de Dados.
 *
 * Estratégia de persistência (req.: restaurar ao recarregar / compartilhar):
 * - Filtros (categoria, família, qualidade) e termo de busca → **URL query
 *   params**. São poucos e curtos, então o link é compartilhável e o reload
 *   restaura tudo.
 * - Conjunto de famílias expandidas e categorias recolhidas → **localStorage**.
 *   Podem ser centenas de nomes longos (até milhares de bitolas na base), o que
 *   inviabiliza colocá-los na URL; é uma preferência de navegação por usuário,
 *   então o reload restaura via localStorage.
 *
 * Não conflita com o histórico de buscas recentes do `useSearch`, que usa uma
 * `storageKey` própria (`materiais:recent-searches`).
 */
export type QualityKey = 'sem_erp' | 'sem_custo' | 'sem_categoria';

const QUALITY_KEYS: QualityKey[] = ['sem_erp', 'sem_custo', 'sem_categoria'];
const EXPANDED_STORAGE_KEY = 'materiais:expanded-groups';
const COLLAPSED_STORAGE_KEY = 'materiais:collapsed-categorias';

function loadSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((x): x is string => typeof x === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

function saveSet(key: string, set: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* quota / disabled storage — ignore */
  }
}

function parseQuality(raw: string | null): Set<QualityKey> {
  if (!raw) return new Set();
  const wanted = new Set(raw.split(','));
  return new Set(QUALITY_KEYS.filter((k) => wanted.has(k)));
}

function setOrDelete(params: URLSearchParams, key: string, value: string): void {
  if (value) params.set(key, value);
  else params.delete(key);
}

export interface BaseDadosUiState {
  /** Valor inicial da busca, lido da URL (passar ao `useSearch`). */
  initialSearch: string;
  /** Espelha o termo de busca atual na URL (chamar quando o input muda). */
  setSearchParam: (term: string) => void;

  categoriaFilter: string;
  setCategoriaFilter: (v: string) => void;
  descFilter: string;
  setDescFilter: (v: string) => void;

  qualityFilters: Set<QualityKey>;
  setQualityFilters: React.Dispatch<React.SetStateAction<Set<QualityKey>>>;

  expandedGroups: Set<string>;
  setExpandedGroups: React.Dispatch<React.SetStateAction<Set<string>>>;
  collapsedCategorias: Set<string>;
  setCollapsedCategorias: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function useBaseDadosUiState(): BaseDadosUiState {
  const [searchParams, setSearchParams] = useSearchParams();

  // Lê os valores iniciais da URL apenas uma vez (no mount). As atualizações
  // posteriores fluem do estado para a URL, nunca o contrário, evitando loops.
  const initial = useRef({
    search: searchParams.get('q') ?? '',
    categoria: searchParams.get('cat') ?? 'all',
    familia: searchParams.get('fam') ?? 'all',
    quality: parseQuality(searchParams.get('qual')),
  }).current;

  const [searchTerm, setSearchTerm] = useState(initial.search);
  const [categoriaFilter, setCategoriaFilter] = useState(initial.categoria);
  const [descFilter, setDescFilter] = useState(initial.familia);
  const [qualityFilters, setQualityFilters] = useState<Set<QualityKey>>(initial.quality);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() =>
    loadSet(EXPANDED_STORAGE_KEY),
  );
  const [collapsedCategorias, setCollapsedCategorias] = useState<Set<string>>(() =>
    loadSet(COLLAPSED_STORAGE_KEY),
  );

  // Persiste expandidos/recolhidos em localStorage.
  useEffect(() => saveSet(EXPANDED_STORAGE_KEY, expandedGroups), [expandedGroups]);
  useEffect(() => saveSet(COLLAPSED_STORAGE_KEY, collapsedCategorias), [collapsedCategorias]);

  // Sincroniza filtros + busca na URL (replace para não poluir o histórico).
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        setOrDelete(next, 'q', searchTerm.trim());
        setOrDelete(next, 'cat', categoriaFilter === 'all' ? '' : categoriaFilter);
        setOrDelete(next, 'fam', descFilter === 'all' ? '' : descFilter);
        setOrDelete(next, 'qual', [...qualityFilters].join(','));
        return next;
      },
      { replace: true },
    );
  }, [searchTerm, categoriaFilter, descFilter, qualityFilters, setSearchParams]);

  const setSearchParam = useCallback((term: string) => setSearchTerm(term), []);

  return {
    initialSearch: initial.search,
    setSearchParam,
    categoriaFilter,
    setCategoriaFilter,
    descFilter,
    setDescFilter,
    qualityFilters,
    setQualityFilters,
    expandedGroups,
    setExpandedGroups,
    collapsedCategorias,
    setCollapsedCategorias,
  };
}

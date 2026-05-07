import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SolicitacoesSortField } from './useSupabaseData';

export const ALL_STATUSES = [
  'Aberta',
  'Aprovada',
  'Material Comprado',
  'Material enviado para Obra',
  'Finalizada',
  'Cancelada',
] as const;

export type StatusValue = (typeof ALL_STATUSES)[number];

export interface SolicitacoesFiltersState {
  page: number;
  pageSize: number;
  sortBy: SolicitacoesSortField;
  sortDir: 'asc' | 'desc';
  search: string;
  status: StatusValue[];
  projetoId: string;
  dateFrom: string;
  dateTo: string;
  preset: 'all' | 'abertas' | 'finalizadas';
}

const DEFAULTS: SolicitacoesFiltersState = {
  page: 0,
  pageSize: 25,
  sortBy: 'created_at',
  sortDir: 'desc',
  search: '',
  status: [],
  projetoId: '',
  dateFrom: '',
  dateTo: '',
  preset: 'all',
};

const PAGE_SIZES = [10, 25, 50, 100] as const;

function parseStatuses(raw: string | null): StatusValue[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is StatusValue => (ALL_STATUSES as readonly string[]).includes(s));
}

function parsePreset(raw: string | null): SolicitacoesFiltersState['preset'] {
  return raw === 'abertas' || raw === 'finalizadas' ? raw : 'all';
}

function parseSortBy(raw: string | null): SolicitacoesSortField {
  const allowed: SolicitacoesSortField[] = ['numero', 'data_solicitacao', 'status', 'erp', 'created_at'];
  return allowed.includes(raw as SolicitacoesSortField)
    ? (raw as SolicitacoesSortField)
    : DEFAULTS.sortBy;
}

export interface UseSolicitacoesFiltersOptions {
  /**
   * When provided, overrides any projeto filter from the URL and prevents
   * `update({ projetoId })` from being persisted. Used when the projeto is
   * implicit in the route (e.g. /projetos/:projetoId/solicitacoes).
   */
  projetoId?: string;
}

export function useSolicitacoesFilters(options: UseSolicitacoesFiltersOptions = {}) {
  const [params, setParams] = useSearchParams();
  const lockedProjetoId = options.projetoId;

  const state: SolicitacoesFiltersState = useMemo(() => {
    const pageSizeRaw = Number(params.get('size') ?? DEFAULTS.pageSize);
    const pageSize = (PAGE_SIZES as readonly number[]).includes(pageSizeRaw)
      ? pageSizeRaw
      : DEFAULTS.pageSize;
    return {
      page: Math.max(0, Number(params.get('page') ?? 0) || 0),
      pageSize,
      sortBy: parseSortBy(params.get('sortBy')),
      sortDir: params.get('sortDir') === 'asc' ? 'asc' : 'desc',
      search: params.get('q') ?? '',
      status: parseStatuses(params.get('status')),
      projetoId: lockedProjetoId ?? params.get('projeto') ?? '',
      dateFrom: params.get('from') ?? '',
      dateTo: params.get('to') ?? '',
      preset: parsePreset(params.get('preset')),
    };
  }, [params, lockedProjetoId]);

  const update = useCallback(
    (patch: Partial<SolicitacoesFiltersState>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const merged = { ...state, ...patch };

          // Any filter change other than a page move resets the page.
          if (!('page' in patch)) merged.page = 0;

          const writeOrDelete = (key: string, value: string) => {
            if (value === '' || value === null || value === undefined) next.delete(key);
            else next.set(key, value);
          };

          writeOrDelete('page', merged.page > 0 ? String(merged.page) : '');
          writeOrDelete('size', merged.pageSize !== DEFAULTS.pageSize ? String(merged.pageSize) : '');
          writeOrDelete('sortBy', merged.sortBy !== DEFAULTS.sortBy ? merged.sortBy : '');
          writeOrDelete('sortDir', merged.sortDir !== DEFAULTS.sortDir ? merged.sortDir : '');
          writeOrDelete('q', merged.search);
          writeOrDelete('status', merged.status.join(','));
          if (lockedProjetoId) {
            next.delete('projeto');
          } else {
            writeOrDelete('projeto', merged.projetoId);
          }
          writeOrDelete('from', merged.dateFrom);
          writeOrDelete('to', merged.dateTo);
          writeOrDelete('preset', merged.preset !== 'all' ? merged.preset : '');

          return next;
        },
        { replace: true },
      );
    },
    [setParams, state, lockedProjetoId],
  );

  const reset = useCallback(() => {
    setParams(new URLSearchParams(), { replace: true });
  }, [setParams]);

  return { state, update, reset, pageSizes: PAGE_SIZES };
}

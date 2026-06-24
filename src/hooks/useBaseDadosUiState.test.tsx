import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useBaseDadosUiState } from './useBaseDadosUiState';

/** Wrapper que monta o hook sob um Router e expõe a URL atual para asserts. */
function makeWrapper(initialEntries: string[]) {
  let search = '';
  function LocationProbe() {
    search = useLocation().search;
    return null;
  }
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(MemoryRouter, { initialEntries }, children, createElement(LocationProbe));
  return { wrapper, getSearch: () => search };
}

describe('useBaseDadosUiState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it('restaura filtros e busca a partir dos query params da URL', () => {
    const { wrapper } = makeWrapper(['/base?q=tubo&cat=Conexoes&fam=Flange&qual=sem_erp,sem_custo']);
    const { result } = renderHook(() => useBaseDadosUiState(), { wrapper });

    expect(result.current.initialSearch).toBe('tubo');
    expect(result.current.categoriaFilter).toBe('Conexoes');
    expect(result.current.descFilter).toBe('Flange');
    expect([...result.current.qualityFilters].sort()).toEqual(['sem_custo', 'sem_erp']);
  });

  it('escreve filtros e busca na URL ao alterar o estado', () => {
    const { wrapper, getSearch } = makeWrapper(['/base']);
    const { result } = renderHook(() => useBaseDadosUiState(), { wrapper });

    act(() => result.current.setCategoriaFilter('Tubos'));
    act(() => result.current.setSearchParam('niple'));

    const params = new URLSearchParams(getSearch());
    expect(params.get('cat')).toBe('Tubos');
    expect(params.get('q')).toBe('niple');
  });

  it('omite da URL filtros em "all" e busca vazia', () => {
    const { wrapper, getSearch } = makeWrapper(['/base?cat=Tubos&q=abc']);
    const { result } = renderHook(() => useBaseDadosUiState(), { wrapper });

    act(() => result.current.setCategoriaFilter('all'));
    act(() => result.current.setSearchParam(''));

    const params = new URLSearchParams(getSearch());
    expect(params.has('cat')).toBe(false);
    expect(params.has('q')).toBe(false);
  });

  it('persiste grupos expandidos e categorias recolhidas no localStorage', () => {
    const { wrapper } = makeWrapper(['/base']);
    const { result } = renderHook(() => useBaseDadosUiState(), { wrapper });

    act(() => result.current.setExpandedGroups(new Set(['Família A'])));
    act(() => result.current.setCollapsedCategorias(new Set(['Cat 1'])));

    expect(JSON.parse(window.localStorage.getItem('materiais:expanded-groups')!)).toEqual(['Família A']);
    expect(JSON.parse(window.localStorage.getItem('materiais:collapsed-categorias')!)).toEqual(['Cat 1']);
  });

  it('restaura grupos expandidos do localStorage no mount', () => {
    window.localStorage.setItem('materiais:expanded-groups', JSON.stringify(['Família X']));
    const { wrapper } = makeWrapper(['/base']);
    const { result } = renderHook(() => useBaseDadosUiState(), { wrapper });

    expect(result.current.expandedGroups.has('Família X')).toBe(true);
  });
});

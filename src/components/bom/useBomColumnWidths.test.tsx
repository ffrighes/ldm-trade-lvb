import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { BomColumnWidthsProvider, useBomColumnWidths } from './useBomColumnWidths';
import { BOM_TABLE_COLUMN_MAP } from './bomTableColumns';

const STORAGE_KEY = 'bom-table-col-widths:v1';

function renderColumnWidths() {
  return renderHook(() => useBomColumnWidths(), {
    wrapper: ({ children }) => <BomColumnWidthsProvider>{children}</BomColumnWidthsProvider>,
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('useBomColumnWidths', () => {
  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useBomColumnWidths())).toThrow();
  });

  it('initializes widths from column defaults', () => {
    const { result } = renderColumnWidths();
    for (const [id, def] of BOM_TABLE_COLUMN_MAP) {
      expect(result.current.widths[id]).toBe(def.defaultWidth);
    }
  });

  it('clamps a resized column at its minWidth', () => {
    const { result } = renderColumnWidths();
    act(() => result.current.setColumnWidth('erp', 5));
    expect(result.current.widths.erp).toBe(BOM_TABLE_COLUMN_MAP.get('erp')!.minWidth);
  });

  it('ignores width changes on non-resizable columns', () => {
    const { result } = renderColumnWidths();
    act(() => result.current.setColumnWidth('actions', 999));
    expect(result.current.widths.actions).toBe(BOM_TABLE_COLUMN_MAP.get('actions')!.defaultWidth);
  });

  it('resets a single column back to its default', () => {
    const { result } = renderColumnWidths();
    act(() => result.current.setColumnWidth('notas', 300));
    expect(result.current.widths.notas).toBe(300);
    act(() => result.current.resetColumn('notas'));
    expect(result.current.widths.notas).toBe(BOM_TABLE_COLUMN_MAP.get('notas')!.defaultWidth);
  });

  it('resets all columns back to defaults', () => {
    const { result } = renderColumnWidths();
    act(() => {
      result.current.setColumnWidth('erp', 200);
      result.current.setColumnWidth('bitola', 90);
    });
    act(() => result.current.resetAll());
    for (const [id, def] of BOM_TABLE_COLUMN_MAP) {
      expect(result.current.widths[id]).toBe(def.defaultWidth);
    }
  });

  it('debounces persistence to localStorage after a resize', async () => {
    const { result } = renderColumnWidths();
    act(() => result.current.setColumnWidth('erp', 150));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    await new Promise((r) => setTimeout(r, 350));
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.erp).toBe(150);
  });

  it('loads persisted widths on mount and clamps below-minWidth values', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ erp: 500, bitola: 1 }),
    );
    const { result } = renderColumnWidths();
    expect(result.current.widths.erp).toBe(500);
    expect(result.current.widths.bitola).toBe(BOM_TABLE_COLUMN_MAP.get('bitola')!.minWidth);
  });
});

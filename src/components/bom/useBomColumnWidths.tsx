import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BOM_TABLE_COLUMNS, BOM_TABLE_COLUMN_MAP, bomColumnCssVar } from './bomTableColumns';

const STORAGE_KEY = 'bom-table-col-widths:v1';

function defaultWidths(): Record<string, number> {
  return Object.fromEntries(BOM_TABLE_COLUMNS.map((c) => [c.id, c.defaultWidth]));
}

function loadWidths(): Record<string, number> {
  const widths = defaultWidths();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return widths;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const col of BOM_TABLE_COLUMNS) {
      const v = parsed[col.id];
      if (typeof v === 'number' && Number.isFinite(v)) {
        widths[col.id] = Math.max(v, col.minWidth);
      }
    }
  } catch {
    /* ignore malformed/unavailable storage */
  }
  return widths;
}

function saveWidths(widths: Record<string, number>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch {
    /* ignore quota/unavailable storage errors */
  }
}

interface BomColumnWidthsContextValue {
  widths: Record<string, number>;
  /** Element carrying the --bom-col-* CSS custom properties consumed by every card's <colgroup>. */
  containerRef: React.RefObject<HTMLDivElement>;
  setColumnWidth: (id: string, px: number) => void;
  resetColumn: (id: string) => void;
  resetAll: () => void;
}

const BomColumnWidthsContext = createContext<BomColumnWidthsContextValue | null>(null);

export function BomColumnWidthsProvider({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<Record<string, number>>(() => loadWidths());
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    for (const col of BOM_TABLE_COLUMNS) {
      if (col.flexible) continue;
      el.style.setProperty(bomColumnCssVar(col.id), `${widths[col.id] ?? col.defaultWidth}px`);
    }
  }, [widths]);

  useLayoutEffect(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => saveWidths(widths), 300);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [widths]);

  const setColumnWidth = useCallback((id: string, px: number) => {
    const def = BOM_TABLE_COLUMN_MAP.get(id);
    if (!def || !def.resizable) return;
    const clamped = Math.max(Math.round(px), def.minWidth);
    setWidths((prev) => (prev[id] === clamped ? prev : { ...prev, [id]: clamped }));
  }, []);

  const resetColumn = useCallback((id: string) => {
    const def = BOM_TABLE_COLUMN_MAP.get(id);
    if (!def) return;
    setWidths((prev) => (prev[id] === def.defaultWidth ? prev : { ...prev, [id]: def.defaultWidth }));
  }, []);

  const resetAll = useCallback(() => {
    setWidths(defaultWidths());
  }, []);

  const value = useMemo<BomColumnWidthsContextValue>(
    () => ({ widths, containerRef, setColumnWidth, resetColumn, resetAll }),
    [widths, setColumnWidth, resetColumn, resetAll],
  );

  return (
    <BomColumnWidthsContext.Provider value={value}>
      <div ref={containerRef} className="contents">
        {children}
      </div>
    </BomColumnWidthsContext.Provider>
  );
}

export function useBomColumnWidths(): BomColumnWidthsContextValue {
  const ctx = useContext(BomColumnWidthsContext);
  if (!ctx) throw new Error('useBomColumnWidths must be used within a BomColumnWidthsProvider');
  return ctx;
}

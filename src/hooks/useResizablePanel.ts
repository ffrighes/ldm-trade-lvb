import { useCallback, useEffect, useRef, useState } from 'react';

interface UseResizablePanelOptions {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
}

interface UseResizablePanelResult {
  width: number;
  isResizing: boolean;
  startResize: (e: React.MouseEvent) => void;
  reset: () => void;
}

function loadWidth(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function saveWidth(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore quota errors */
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function useResizablePanel(
  options: UseResizablePanelOptions,
): UseResizablePanelResult {
  const { storageKey, defaultWidth, minWidth, maxWidth } = options;
  const [width, setWidth] = useState<number>(() =>
    clamp(loadWidth(storageKey, defaultWidth), minWidth, maxWidth),
  );
  const [isResizing, setIsResizing] = useState(false);

  const dragOriginXRef = useRef(0);
  const dragOriginWidthRef = useRef(0);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragOriginXRef.current = e.clientX;
    dragOriginWidthRef.current = width;
    setIsResizing(true);
  }, [width]);

  const reset = useCallback(() => {
    setWidth(defaultWidth);
    saveWidth(storageKey, defaultWidth);
  }, [defaultWidth, storageKey]);

  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragOriginXRef.current;
      const next = clamp(
        dragOriginWidthRef.current + delta,
        minWidth,
        maxWidth,
      );
      setWidth(next);
    };

    const onMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    const prevUserSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
    };
  }, [isResizing, minWidth, maxWidth]);

  useEffect(() => {
    if (isResizing) return;
    saveWidth(storageKey, width);
  }, [isResizing, storageKey, width]);

  return { width, isResizing, startResize, reset };
}

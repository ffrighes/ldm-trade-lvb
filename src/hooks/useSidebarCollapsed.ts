import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'app-sidebar-collapsed';

function loadCollapsed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'true';
  } catch {
    return false;
  }
}

function saveCollapsed(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* ignore quota errors */
  }
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState<boolean>(() => loadCollapsed());

  useEffect(() => {
    saveCollapsed(collapsed);
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  return { collapsed, setCollapsed, toggle };
}

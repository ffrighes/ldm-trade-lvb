import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  isValidSearch,
  sanitizeSearch,
} from '@/lib/sanitizeSearch';

const RECENT_MAX = 5;

export interface UseSearchOptions {
  initialValue?: string;
  debounceMs?: number;
  minLength?: number;
  /** localStorage key for recent searches; pass undefined to disable history. */
  storageKey?: string;
  onDebouncedChange?: (debounced: string) => void;
}

export interface UseSearchResult {
  /** Raw, instant input value (bind to <input value=...>). */
  input: string;
  setInput: (v: string) => void;
  /** Sanitized + debounced value safe to send to the server. */
  debounced: string;
  /** True between input change and debounce flush. */
  isDebouncing: boolean;
  /** True when input is non-empty but too short / too long to query. */
  isBelowMin: boolean;
  clear: () => void;
  recent: string[];
  pushRecent: (term: string) => void;
  removeRecent: (term: string) => void;
  clearRecent: () => void;
}

function loadRecent(key: string | undefined): string[] {
  if (!key || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function saveRecent(key: string | undefined, list: string[]) {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    /* quota / disabled storage — ignore */
  }
}

export function useSearch(options: UseSearchOptions = {}): UseSearchResult {
  const {
    initialValue = '',
    debounceMs = 300,
    minLength = SEARCH_MIN_LENGTH,
    storageKey,
    onDebouncedChange,
  } = options;

  const [input, setInputState] = useState(initialValue);
  const [debounced, setDebounced] = useState(() => sanitizeSearch(initialValue));
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => loadRecent(storageKey));
  const onChangeRef = useRef(onDebouncedChange);
  onChangeRef.current = onDebouncedChange;

  const setInput = useCallback((v: string) => {
    setInputState(v.slice(0, SEARCH_MAX_LENGTH));
  }, []);

  useEffect(() => {
    const sanitized = sanitizeSearch(input);
    const next = sanitized.length === 0 || sanitized.length >= minLength ? sanitized : '';

    if (next === debounced) {
      setIsDebouncing(false);
      return;
    }

    setIsDebouncing(true);
    const t = window.setTimeout(() => {
      setDebounced(next);
      setIsDebouncing(false);
      onChangeRef.current?.(next);
    }, debounceMs);
    return () => window.clearTimeout(t);
  }, [input, debounceMs, minLength, debounced]);

  const clear = useCallback(() => setInputState(''), []);

  const pushRecent = useCallback(
    (term: string) => {
      const t = sanitizeSearch(term);
      if (!isValidSearch(t)) return;
      setRecent((prev) => {
        const next = [t, ...prev.filter((x) => x !== t)].slice(0, RECENT_MAX);
        saveRecent(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const removeRecent = useCallback(
    (term: string) => {
      setRecent((prev) => {
        const next = prev.filter((x) => x !== term);
        saveRecent(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const clearRecent = useCallback(() => {
    setRecent([]);
    saveRecent(storageKey, []);
  }, [storageKey]);

  const trimmed = input.trim();
  const isBelowMin = trimmed.length > 0 && trimmed.length < minLength;

  return {
    input,
    setInput,
    debounced,
    isDebouncing,
    isBelowMin,
    clear,
    recent,
    pushRecent,
    removeRecent,
    clearRecent,
  };
}

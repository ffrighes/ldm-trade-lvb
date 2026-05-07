import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearch } from './useSearch';

describe('useSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces input changes', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useSearch({ debounceMs: 300, onDebouncedChange: onChange }),
    );

    act(() => result.current.setInput('he'));
    act(() => result.current.setInput('hel'));
    act(() => result.current.setInput('hello'));

    expect(result.current.isDebouncing).toBe(true);
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debounced).toBe('hello');
    expect(result.current.isDebouncing).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('hello');
  });

  it('does not emit a value below minLength', () => {
    const { result } = renderHook(() => useSearch({ debounceMs: 100 }));

    act(() => result.current.setInput('a'));
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.debounced).toBe('');
    expect(result.current.isBelowMin).toBe(true);
  });

  it('sanitizes the debounced value', () => {
    const { result } = renderHook(() => useSearch({ debounceMs: 100 }));
    act(() => result.current.setInput('a%b_c,d'));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.debounced).toBe('a b c d');
  });

  it('clear() empties the input', () => {
    const { result } = renderHook(() => useSearch({ debounceMs: 100 }));
    act(() => result.current.setInput('hello'));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => result.current.clear());
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.input).toBe('');
    expect(result.current.debounced).toBe('');
  });

  it('persists recent searches to localStorage (max 5, dedupes)', () => {
    const { result } = renderHook(() =>
      useSearch({ debounceMs: 100, storageKey: 'k' }),
    );
    act(() => {
      result.current.pushRecent('alpha');
      result.current.pushRecent('beta');
      result.current.pushRecent('gamma');
      result.current.pushRecent('delta');
      result.current.pushRecent('epsilon');
      result.current.pushRecent('zeta');
      result.current.pushRecent('alpha'); // moves alpha to top, no dup
    });
    expect(result.current.recent).toEqual(['alpha', 'zeta', 'epsilon', 'delta', 'gamma']);
    expect(JSON.parse(window.localStorage.getItem('k')!)).toEqual(result.current.recent);
  });

  it('rejects invalid recent entries', () => {
    const { result } = renderHook(() => useSearch({ storageKey: 'k' }));
    act(() => {
      result.current.pushRecent('a'); // too short
      result.current.pushRecent('');
    });
    expect(result.current.recent).toEqual([]);
  });
});

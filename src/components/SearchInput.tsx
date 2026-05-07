import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  ariaLabel: string;
  isLoading?: boolean;
  /** Bind Cmd/Ctrl+K to focus this input. Default: true. */
  bindShortcut?: boolean;
  /** id of an aria-live region announcing result count. */
  ariaControls?: string;
  className?: string;
  maxLength?: number;
  autoFocus?: boolean;
  belowMinHint?: string;
  showBelowMinHint?: boolean;
}

export interface SearchInputRef {
  focus: () => void;
}

export const SearchInput = forwardRef<SearchInputRef, SearchInputProps>(function SearchInput(
  {
    value,
    onChange,
    onClear,
    placeholder = 'Buscar…',
    ariaLabel,
    isLoading = false,
    bindShortcut = true,
    ariaControls,
    className,
    maxLength = 100,
    autoFocus = false,
    belowMinHint,
    showBelowMinHint = false,
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useRef(`search-hint-${Math.random().toString(36).slice(2, 8)}`).current;

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

  useEffect(() => {
    if (!bindShortcut) return;
    const handler = (e: KeyboardEvent) => {
      // Cmd+K (mac) or Ctrl+K — WCAG 2.1 SC 2.1.1 Keyboard
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bindShortcut]);

  const handleClear = () => {
    onChange('');
    onClear?.();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && value) {
      e.preventDefault();
      handleClear();
    }
  };

  return (
    <div className={cn('relative', className)}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        type="search"
        role="searchbox"
        autoFocus={autoFocus}
        className="pl-10 pr-16"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        aria-controls={ariaControls}
        aria-describedby={showBelowMinHint && belowMinHint ? hintId : undefined}
        aria-busy={isLoading || undefined}
        maxLength={maxLength}
        autoComplete="off"
        spellCheck={false}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {isLoading && (
          <Loader2
            className="h-4 w-4 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Limpar busca"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        {bindShortcut && !value && !isLoading && (
          <kbd
            className="hidden sm:inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            aria-hidden="true"
          >
            ⌘K
          </kbd>
        )}
      </div>
      {showBelowMinHint && belowMinHint && (
        <p id={hintId} className="mt-1 text-xs text-muted-foreground">
          {belowMinHint}
        </p>
      )}
    </div>
  );
});

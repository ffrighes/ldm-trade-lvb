import { Fragment, type ReactNode } from 'react';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Splits `text` and wraps each occurrence of `term` in <mark>. Case-insensitive.
// Returns the original string when term is empty or not found.
export function highlightMatch(text: string, term: string): ReactNode {
  const cleaned = term.trim();
  if (!cleaned) return text;
  const re = new RegExp(`(${escapeRegExp(cleaned)})`, 'gi');
  const lower = cleaned.toLowerCase();
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === lower ? (
          <mark key={i} className="bg-yellow-200 text-foreground rounded px-0.5">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

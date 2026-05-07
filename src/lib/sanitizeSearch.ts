export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;

// Strip characters that are unsafe for PostgREST `.or()` filter expressions
// (`,` `(` `)`) and for `ilike` wildcards (`%` `_`). Also collapse whitespace.
// The Supabase client parameterizes values, so this is defense-in-depth — we
// strip characters that have *no business* in a free-text search.
export function sanitizeSearch(raw: string): string {
  return raw
    .replace(/[%_,()*\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SEARCH_MAX_LENGTH);
}

export function isValidSearch(term: string): boolean {
  const t = term.trim();
  return t.length >= SEARCH_MIN_LENGTH && t.length <= SEARCH_MAX_LENGTH;
}

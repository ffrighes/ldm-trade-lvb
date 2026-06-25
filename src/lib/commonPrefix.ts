/**
 * Returns the longest common prefix shared by all strings in the array.
 * Returns empty string for empty arrays or a single-item array.
 */
export function longestCommonPrefix(strings: string[]): string {
  if (strings.length < 2) return '';
  const first = strings[0];
  let len = first.length;
  for (let i = 1; i < strings.length; i++) {
    const s = strings[i];
    let j = 0;
    while (j < len && j < s.length && first[j] === s[j]) j++;
    len = j;
    if (len === 0) return '';
  }
  return first.slice(0, len);
}

/**
 * Returns a "significant" common prefix: trims trailing separators/spaces
 * and enforces a minimum length. Returns empty string if not significant.
 */
export function significantCommonPrefix(
  strings: string[],
  minLength = 10,
): string {
  const raw = longestCommonPrefix(strings);
  const trimmed = raw.replace(/[\s\-–—,/]+$/, '');
  if (trimmed.length < minLength) return '';
  return trimmed;
}

/**
 * Extracts the distinctive suffix of a string after removing a known prefix.
 * Falls back to the full string if prefix doesn't match.
 */
export function extractSuffix(str: string, prefix: string): string {
  if (!prefix || !str.startsWith(prefix)) return str;
  return str.slice(prefix.length).replace(/^[\s\-–—,/]+/, '');
}

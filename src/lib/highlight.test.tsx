import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { highlightMatch } from './highlight';

describe('highlightMatch', () => {
  it('returns plain text when term is empty', () => {
    const { container } = render(<>{highlightMatch('hello world', '')}</>);
    expect(container.querySelector('mark')).toBeNull();
    expect(container.textContent).toBe('hello world');
  });

  it('wraps occurrences case-insensitively', () => {
    const { container } = render(<>{highlightMatch('Hello hello HELLO', 'hello')}</>);
    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(3);
    expect(marks[0].textContent).toBe('Hello');
    expect(marks[2].textContent).toBe('HELLO');
  });

  it('does not break on regex metacharacters in the term', () => {
    const { container } = render(<>{highlightMatch('a.b.c', '.')}</>);
    expect(container.querySelectorAll('mark').length).toBeGreaterThan(0);
    expect(container.textContent).toBe('a.b.c');
  });
});

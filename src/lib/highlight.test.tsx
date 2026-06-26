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

  it('matches without accents while preserving the original accents in the mark', () => {
    const { container } = render(<>{highlightMatch('Válvula de esfera', 'valvula')}</>);
    const mark = container.querySelector('mark');
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe('Válvula');
    expect(container.textContent).toBe('Válvula de esfera');
  });

  it('matches a fully-accented word from an unaccented term', () => {
    const { container } = render(<>{highlightMatch('Conexão', 'conexao')}</>);
    const mark = container.querySelector('mark');
    expect(mark?.textContent).toBe('Conexão');
    expect(container.textContent).toBe('Conexão');
  });

  it('matches "borboleta" against "Borboleta" (BomTree acceptance criterion)', () => {
    const { container } = render(<>{highlightMatch('Borboleta 1/2"', 'borboleta')}</>);
    const mark = container.querySelector('mark');
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe('Borboleta');
    expect(container.textContent).toBe('Borboleta 1/2"');
  });

  it('highlights mid-word accent match and preserves surrounding text', () => {
    const { container } = render(<>{highlightMatch('Válvula de esfera', 'valvula de')}</>);
    const mark = container.querySelector('mark');
    expect(mark?.textContent).toBe('Válvula de');
    expect(container.textContent).toBe('Válvula de esfera');
  });
});

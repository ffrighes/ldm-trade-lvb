import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  it('renders with aria-label and value', () => {
    render(<SearchInput value="foo" onChange={() => {}} ariaLabel="Buscar" />);
    const input = screen.getByLabelText('Buscar') as HTMLInputElement;
    expect(input.value).toBe('foo');
    expect(input).toHaveAttribute('role', 'searchbox');
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} ariaLabel="Buscar" />);
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('shows a clear button only when there is text and clears on click', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SearchInput value="" onChange={onChange} ariaLabel="Buscar" />,
    );
    expect(screen.queryByLabelText('Limpar busca')).toBeNull();

    rerender(<SearchInput value="hello" onChange={onChange} ariaLabel="Buscar" />);
    fireEvent.click(screen.getByLabelText('Limpar busca'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('clears value on Escape', () => {
    const onChange = vi.fn();
    render(<SearchInput value="hello" onChange={onChange} ariaLabel="Buscar" />);
    fireEvent.keyDown(screen.getByLabelText('Buscar'), { key: 'Escape' });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('focuses on Cmd/Ctrl+K', () => {
    render(<SearchInput value="" onChange={() => {}} ariaLabel="Buscar" />);
    const input = screen.getByLabelText('Buscar') as HTMLInputElement;
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(document.activeElement).toBe(input);
  });

  it('exposes aria-busy when loading', () => {
    render(
      <SearchInput value="x" onChange={() => {}} ariaLabel="Buscar" isLoading />,
    );
    expect(screen.getByLabelText('Buscar')).toHaveAttribute('aria-busy', 'true');
  });
});

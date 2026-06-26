import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

import { InlineQuantityEditor } from './InlineQuantityEditor';

beforeEach(() => toastError.mockReset());

function openEditor(quantity = 2) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<InlineQuantityEditor quantity={quantity} canEdit onSave={onSave} />);
  fireEvent.click(screen.getByRole('button', { name: /editar quantidade/i }));
  return { onSave, input: screen.getByLabelText('Quantidade') as HTMLInputElement };
}

describe('InlineQuantityEditor', () => {
  it('shows a static badge and no edit affordance when canEdit is false', () => {
    render(<InlineQuantityEditor quantity={4} canEdit={false} onSave={vi.fn()} />);
    expect(screen.getByText(/×\s*4/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('persists an integer ≥ 1 on Enter', async () => {
    const { onSave, input } = openEditor(2);
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(5));
    expect(toastError).not.toHaveBeenCalled();
  });

  it('persists on blur', async () => {
    const { onSave, input } = openEditor(2);
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.blur(input);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(3));
  });

  it.each(['0', '-1', '1.5', 'abc', ''])(
    'rejects %j with a toast and does not call onSave',
    async (bad) => {
      const { onSave, input } = openEditor(2);
      fireEvent.change(input, { target: { value: bad } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(toastError).toHaveBeenCalled());
      expect(onSave).not.toHaveBeenCalled();
    },
  );

  it('does not persist when the value is unchanged', async () => {
    const { onSave, input } = openEditor(2);
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.queryByLabelText('Quantidade')).toBeNull());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('cancels on Escape without saving', async () => {
    const { onSave, input } = openEditor(2);
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByLabelText('Quantidade')).toBeNull());
    expect(onSave).not.toHaveBeenCalled();
  });
});

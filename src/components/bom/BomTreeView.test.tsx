import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockMutateAsync = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PointerSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  useDraggable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  })),
  useDroppable: vi.fn(() => ({
    setNodeRef: vi.fn(),
    isOver: false,
  })),
}));

vi.mock('@/hooks/useBomTree', () => ({
  useUpdateBomNode: vi.fn(() => ({ mutateAsync: mockMutateAsync, isPending: false })),
  useDuplicateBomSubtree: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useMoveBomNode: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useRemoveBomSubtree: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useAddBomNode: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useBomNodes: vi.fn(() => ({ data: [], isLoading: false })),
  buildBomTree: vi.fn(),
}));

vi.mock('@/hooks/useSupabaseData', () => ({
  useMaterials: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/hooks/useCategorias', () => ({
  useCategorias: vi.fn(() => ({ data: [] })),
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

vi.mock('@/components/bom/BomNodeIcon', () => ({
  BomNodeIcon: () => <span data-testid="bom-node-icon" />,
  bomNodeTypeLabel: (t: string) => t,
}));

vi.mock('@/lib/categorias', () => ({ SEM_CATEGORIA_LABEL: 'Sem Categoria' }));

import { NodeRow } from './BomTreeView';
import type { BomTreeNode } from '@/types/bom';

const makeSubNode = (overrides: Partial<BomTreeNode> = {}): BomTreeNode => ({
  id: 'sub-1',
  version_id: 'v1',
  parent_id: 'root-1',
  node_type: 'SUBCONJUNTO',
  name: 'Sub A',
  quantity: 2,
  cumulativeQuantity: 2,
  position: 0,
  material_id: null,
  notes: null,
  cloned_from_node_id: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  children: [],
  ...overrides,
});

const defaultProps = {
  depth: 1,
  expanded: new Set<string>(),
  setExpanded: vi.fn(),
  matById: new Map(),
  materials: [],
  categoriaOrder: [],
  showCumulative: false,
  editingItems: new Set<string>(),
  onToggleItemEdit: vi.fn(),
  onOpenItemEdit: vi.fn(),
  drafts: {},
  onAddDraft: vi.fn(),
  onRemoveDraft: vi.fn(),
  onAdd: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  visible: true,
  search: '',
  siblings: 1,
  siblingIndex: 0,
};

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockResolvedValue(undefined);
});

describe('NodeRow — inline quantity edit', () => {
  it('shows edit-quantity button for SUBCONJUNTO when readOnly=false', () => {
    render(
      <NodeRow node={makeSubNode()} readOnly={false} {...defaultProps} />,
      { wrapper },
    );
    expect(screen.getByRole('button', { name: 'Editar quantidade' })).toBeInTheDocument();
  });

  it('does not show edit-quantity button when readOnly=true', () => {
    render(
      <NodeRow node={makeSubNode()} readOnly={true} {...defaultProps} />,
      { wrapper },
    );
    expect(screen.queryByRole('button', { name: 'Editar quantidade' })).toBeNull();
  });

  it('clicking the pencil reveals input with the current quantity value', async () => {
    render(
      <NodeRow node={makeSubNode()} readOnly={false} {...defaultProps} />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Editar quantidade' }));
    const input = await screen.findByRole('spinbutton', { name: 'Nova quantidade' });
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe('2');
  });

  it('confirming with value 0 shows toast.error and does not call the mutation', async () => {
    render(
      <NodeRow node={makeSubNode()} readOnly={false} {...defaultProps} />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Editar quantidade' }));
    const input = await screen.findByRole('spinbutton', { name: 'Nova quantidade' });
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar quantidade' }));
    expect(mockToastError).toHaveBeenCalledWith('Quantidade deve ser maior que zero');
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('confirming with a valid new value calls the mutation with correct args', async () => {
    render(
      <NodeRow node={makeSubNode()} readOnly={false} {...defaultProps} />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Editar quantidade' }));
    const input = await screen.findByRole('spinbutton', { name: 'Nova quantidade' });
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar quantidade' }));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({
      versionId: 'v1',
      nodeId: 'sub-1',
      quantity: 5,
    }));
  });

  it('pressing Esc closes the input without calling the mutation', async () => {
    render(
      <NodeRow node={makeSubNode()} readOnly={false} {...defaultProps} />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Editar quantidade' }));
    const input = await screen.findByRole('spinbutton', { name: 'Nova quantidade' });
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('spinbutton', { name: 'Nova quantidade' })).toBeNull(),
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useSupabaseData', () => ({
  useMaterials: () => ({ data: [
    { id: 'm1', descricao: 'Tubo', bitola: '1/2', unidade: 'm', categoria: 'Tubulação', erp: 'E1', notas: null },
    { id: 'm2', descricao: 'Flange', bitola: '2', unidade: 'un', categoria: 'Flanges', erp: 'E2', notas: null },
  ] }),
}));
vi.mock('@/hooks/useCategorias', () => ({ useCategorias: () => ({ data: ['Tubulação', 'Flanges'] }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const nodes = [
  { id: 'root', version_id: 'v1', parent_id: null, node_type: 'CONJUNTO', name: 'Raiz', position: 0, material_id: null, quantity: null, notes: null, fornecedor_id: null, fornecedor: null },
  { id: 'i1', version_id: 'v1', parent_id: 'root', node_type: 'ITEM', name: 'TAG1', position: 0, material_id: 'm1', quantity: 2, notes: null, fornecedor_id: null, fornecedor: null },
  { id: 'i2', version_id: 'v1', parent_id: 'root', node_type: 'ITEM', name: 'TAG2', position: 1, material_id: 'm2', quantity: 1, notes: null, fornecedor_id: null, fornecedor: null },
];

vi.mock('@/hooks/useBomTree', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useBomTree')>('@/hooks/useBomTree');
  return {
    ...actual,
    useBomNodes: () => ({ data: nodes, isLoading: false }),
    useAddBomNode: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDuplicateBomSubtree: () => ({ mutateAsync: vi.fn() }),
    useMoveBomNode: () => ({ mutateAsync: vi.fn() }),
    useRemoveBomSubtree: () => ({ mutateAsync: vi.fn() }),
    useReorderBomNodes: () => ({ mutateAsync: vi.fn() }),
    useUpdateBomNode: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});

import { BomTreeView } from './BomTreeView';

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('BomTreeView column alignment', () => {
  it('renders two category cards with identical colgroup widths for shared columns', () => {
    renderWithClient(
      <BomTreeView versionId="v1" projectId="p1" rootId="root" readOnly={false} />,
    );

    const tables = document.querySelectorAll('table');
    expect(tables.length).toBeGreaterThanOrEqual(2);

    const widthsByTable = Array.from(tables).map((t) =>
      Array.from(t.querySelectorAll('colgroup col')).map((c) => (c as HTMLElement).style.width),
    );
    // Every category card's colgroup must be structurally identical (var()-driven widths).
    for (const w of widthsByTable) expect(w).toEqual(widthsByTable[0]);

    // Resize handles exist for resizable columns with proper a11y wiring.
    const handle = screen.getAllByRole('separator', { name: /Redimensionar coluna ERP/i })[0];
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    expect(handle).toHaveAttribute('tabIndex', '0');

    // Header labels present and aligned via <th> in each card.
    expect(within(tables[0] as HTMLElement).getByText('ERP')).toBeInTheDocument();
    expect(within(tables[1] as HTMLElement).getByText('ERP')).toBeInTheDocument();
  });

  it('renders without the actions column and stays aligned in readOnly mode', () => {
    renderWithClient(
      <BomTreeView versionId="v1" projectId="p1" rootId="root" readOnly />,
    );
    const tables = document.querySelectorAll('table');
    expect(tables.length).toBeGreaterThanOrEqual(1);
    for (const t of Array.from(tables)) {
      expect(within(t as HTMLElement).queryAllByRole('separator', { name: /Ações/i })).toHaveLength(0);
    }
  });
});

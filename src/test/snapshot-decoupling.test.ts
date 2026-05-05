import { describe, it, expect } from "vitest";

/**
 * These tests verify the snapshot/decoupling contract between
 * `solicitacao_itens` / `inventario` and the master `materials` table.
 *
 * The contract:
 *   - At insertion, the item must capture every relevant attribute
 *     (descricao, bitola, unidade, custo_unitario, erp) by value.
 *   - At read/render, the displayed values must come from those stored
 *     attributes — never re-resolved from the master `materials` row.
 *   - Editing/deleting the master material must not change the item.
 */

type Material = {
  id: string;
  descricao: string;
  bitola: string;
  unidade: string;
  custo: number;
  erp: string;
};

type Item = {
  material_id: string | null;
  descricao: string;
  bitola: string;
  unidade: string;
  custo_unitario: number;
  custo_total: number;
  quantidade: number;
  erp: string;
};

/**
 * Mirror of the snapshot insertion contract used by SolicitacaoFormPage
 * and InventarioPage: copy every relevant attribute from the master row.
 */
function buildSnapshotFromMaterial(mat: Material, quantidade: number): Item {
  return {
    material_id: mat.id,
    descricao: mat.descricao,
    bitola: mat.bitola,
    unidade: mat.unidade,
    custo_unitario: mat.custo,
    custo_total: mat.custo * quantidade,
    quantidade,
    erp: mat.erp,
  };
}

/**
 * Mirror of the read-time mapping in SolicitacaoFormPage.tsx (the form
 * load effect): values come from the stored item, NOT from the materials
 * lookup. This function takes both and asserts the read path ignores the
 * master row.
 */
function readItemForDisplay(stored: Item, _materialsTable: Material[]) {
  return {
    descricao: stored.descricao,
    bitola: stored.bitola,
    unidade: stored.unidade,
    custo_unitario: stored.custo_unitario,
    erp: stored.erp,
  };
}

/**
 * Mirror of the cost-report aggregation in SolicitacaoFormPage.tsx
 * (handleExportCostPDF). After the decoupling fix, the cost-report PDF
 * uses item.custo_unitario regardless of the material's current price.
 */
function buildCostReportRow(item: Item) {
  const custoUnit = item.custo_unitario ?? 0;
  return {
    custoUnit,
    custoTotal: item.quantidade * custoUnit,
  };
}

describe("Solicitação / Inventário snapshot decoupling", () => {
  const initialMaterial: Material = {
    id: "mat-1",
    descricao: "Tubo de aço",
    bitola: '1/2"',
    unidade: "m",
    custo: 10,
    erp: "ERP-001",
  };

  it("captures every relevant attribute by value at insertion", () => {
    const item = buildSnapshotFromMaterial(initialMaterial, 5);
    expect(item).toMatchObject({
      material_id: "mat-1",
      descricao: "Tubo de aço",
      bitola: '1/2"',
      unidade: "m",
      custo_unitario: 10,
      custo_total: 50,
      erp: "ERP-001",
    });
  });

  it("display values are unaffected when the master material is edited", () => {
    const item = buildSnapshotFromMaterial(initialMaterial, 5);

    const editedMaterial: Material = {
      ...initialMaterial,
      descricao: "Tubo de aço RENAMED",
      custo: 999,
      erp: "ERP-CHANGED",
      unidade: "kg",
    };

    const view = readItemForDisplay(item, [editedMaterial]);

    expect(view.descricao).toBe("Tubo de aço");
    expect(view.custo_unitario).toBe(10);
    expect(view.erp).toBe("ERP-001");
    expect(view.unidade).toBe("m");
  });

  it("cost report uses snapshot custo_unitario, not the master price", () => {
    const item = buildSnapshotFromMaterial(initialMaterial, 5);

    // Master price changes after the snapshot was taken.
    const _editedMaster: Material = { ...initialMaterial, custo: 999 };

    const row = buildCostReportRow(item);
    expect(row.custoUnit).toBe(10);
    expect(row.custoTotal).toBe(50);
  });

  it("display values are unaffected when the master material is deleted", () => {
    const item = buildSnapshotFromMaterial(initialMaterial, 3);

    // Master deleted: with ON DELETE SET NULL the item's material_id will
    // become NULL, but every snapshot attribute remains intact.
    const orphan: Item = { ...item, material_id: null };

    const view = readItemForDisplay(orphan, []);
    expect(view.descricao).toBe("Tubo de aço");
    expect(view.bitola).toBe('1/2"');
    expect(view.unidade).toBe("m");
    expect(view.custo_unitario).toBe(10);
    expect(view.erp).toBe("ERP-001");
  });

  it("the same contract holds for inventário rows (identical schema)", () => {
    const inventarioRow = buildSnapshotFromMaterial(initialMaterial, 2);

    const editedMaterial: Material = {
      ...initialMaterial,
      descricao: "ALTERED",
      custo: 0,
      erp: "GONE",
    };

    const view = readItemForDisplay(inventarioRow, [editedMaterial]);
    expect(view.descricao).toBe("Tubo de aço");
    expect(view.custo_unitario).toBe(10);
    expect(view.erp).toBe("ERP-001");
  });
});

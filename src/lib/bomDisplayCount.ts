/**
 * nodeCount: raw bom_node row count for the version (includes the root CONJUNTO node)
 * childRootCount: direct child bom_root records (conjuntos filhos + catalog usages)
 * draftCount: unsaved item draft rows open in the UI
 */
export function computeBomNodeDisplay(
  nodeCount: number,
  childRootCount: number,
  draftCount: number = 0,
): { total: number; isEmpty: boolean } {
  const internalNodes = Math.max(0, nodeCount - 1);
  return {
    total: internalNodes + childRootCount,
    isEmpty: internalNodes === 0 && childRootCount === 0 && draftCount === 0,
  };
}

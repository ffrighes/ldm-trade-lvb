/**
 * Pure ordering service for BOM sibling reordering.
 *
 * Positions are stored as dense, non-negative integers (`bom_node.position`).
 * These helpers compute the *minimal* set of position updates required to
 * realise a new sibling order, so a single drag never rewrites the position of
 * siblings whose index did not actually change (idempotent, minimal batch).
 */

export interface PositionedItem {
  id: string;
  position: number;
}

/**
 * Returns `ids` reordered so that `activeId` is moved into the slot currently
 * occupied by `overId`. Returns a fresh copy of the original order when the move
 * is a no-op (either id missing, or both refer to the same slot).
 */
export function reorderIds(ids: string[], activeId: string, overId: string): string[] {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return ids.slice();
  const next = ids.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Given the current siblings and a target order (`nextIds`), returns only the
 * entries whose dense 0..n-1 position changes. Siblings already at their target
 * index are omitted, so unaffected rows are never rewritten.
 *
 * Sparse or duplicate input positions are normalised to dense indexes, which
 * makes the operation self-healing across calls.
 */
export function minimalPositionUpdates(
  siblings: PositionedItem[],
  nextIds: string[],
): PositionedItem[] {
  const prevPos = new Map(siblings.map((s) => [s.id, s.position]));
  const updates: PositionedItem[] = [];
  nextIds.forEach((id, index) => {
    if (prevPos.get(id) !== index) updates.push({ id, position: index });
  });
  return updates;
}

/**
 * Moves `activeId` onto `overId`'s slot and returns the minimal position
 * updates. Empty array when the move changes nothing.
 */
export function reorderPositionUpdates(
  siblings: PositionedItem[],
  activeId: string,
  overId: string,
): PositionedItem[] {
  const nextIds = reorderIds(
    siblings.map((s) => s.id),
    activeId,
    overId,
  );
  return minimalPositionUpdates(siblings, nextIds);
}

/**
 * Shifts a single sibling one slot up (`-1`) or down (`+1`) and returns the
 * minimal position updates. Empty array when the move would fall off either end
 * or the id is unknown. Used by the keyboard "move up / move down" controls.
 */
export function shiftPositionUpdates(
  siblings: PositionedItem[],
  id: string,
  direction: -1 | 1,
): PositionedItem[] {
  const ids = siblings.map((s) => s.id);
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= ids.length) return [];
  return reorderPositionUpdates(siblings, id, ids[target]);
}

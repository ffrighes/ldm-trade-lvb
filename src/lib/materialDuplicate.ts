/**
 * Procura, na lista de materiais já carregada no client, um item com a mesma
 * família (descricao) + bitola (case-insensitive, trim), ignorando o próprio
 * registro em edição. Usado para checagem de duplicidade pré-submit no
 * modal de item da Base de Dados.
 */
export function findDuplicateMaterial<T extends { id: string; descricao: string; bitola: string }>(
  materials: T[],
  descricao: string,
  bitola: string,
  editingId: string | null,
): T | null {
  const desc = descricao.trim().toLowerCase();
  const bit = bitola.trim().toLowerCase();
  if (!desc || !bit) return null;
  return (
    materials.find(
      (m) =>
        m.id !== editingId &&
        m.descricao.trim().toLowerCase() === desc &&
        m.bitola.trim().toLowerCase() === bit,
    ) ?? null
  );
}

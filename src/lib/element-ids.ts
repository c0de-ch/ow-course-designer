/**
 * Element ids for saving a course. Elements refer to each other by id (a
 * gate's `between: [fromId, toId]` in its metadata), so a save keeps each
 * element's id. An id is replaced only when it is missing, malformed, used
 * twice in the course, or taken by another course's element; references to
 * a replaced id are rewritten to the new one.
 */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function assignElementIds<T extends { id?: string; metadata?: string | null }>(
  elements: T[],
  takenElsewhere: Set<string>,
  newId: () => string
): (T & { id: string })[] {
  const seen = new Set<string>();
  const renamed = new Map<string, string>();

  const withIds = elements.map((el) => {
    const keep = el.id && ID_PATTERN.test(el.id) && !seen.has(el.id) && !takenElsewhere.has(el.id);
    const id = keep ? el.id! : newId();
    if (el.id && !keep && !renamed.has(el.id)) renamed.set(el.id, id);
    seen.add(id);
    return { ...el, id };
  });
  // A duplicate's references stay with the element that kept the id
  for (const kept of seen) renamed.delete(kept);
  if (renamed.size === 0) return withIds;

  return withIds.map((el) => ({ ...el, metadata: renameRefs(el.metadata, renamed) }));
}

function renameRefs(metadata: string | null | undefined, renamed: Map<string, string>): string | null | undefined {
  if (!metadata) return metadata;
  try {
    const m = JSON.parse(metadata);
    if (!Array.isArray(m?.between)) return metadata;
    const between = m.between.map((ref: unknown) => (typeof ref === "string" ? renamed.get(ref) ?? ref : ref));
    return JSON.stringify({ ...m, between });
  } catch {
    return metadata;
  }
}

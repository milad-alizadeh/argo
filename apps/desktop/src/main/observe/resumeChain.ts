import type { LogicalSession, ParsedTranscript } from './types'

// Claude writes a NEW file with a NEW sessionId on resume, chained to its parent by the
// head `leafUuid` pointer (ADR-0008). Stitch re-assembles those files into one logical
// rail Session at read time — no file is re-keyed, each keeps its own sessionId.

export function stitch(parsed: ParsedTranscript[]): LogicalSession[] {
  const ownerByUuid = new Map<string, ParsedTranscript>()
  for (const file of parsed) {
    for (const uuid of file.messageUuids) ownerByUuid.set(uuid, file)
  }

  const parentOf = (file: ParsedTranscript): ParsedTranscript | null => {
    if (file.headLeafUuid === null) return null
    const owner = ownerByUuid.get(file.headLeafUuid) ?? null
    // A head pointer owned by the file itself (or unresolved) marks a root, not a child.
    return owner === file ? null : owner
  }

  const childrenByParentId = new Map<string, ParsedTranscript[]>()
  const roots: ParsedTranscript[] = []
  for (const file of parsed) {
    const parent = parentOf(file)
    if (parent === null) {
      roots.push(file)
      continue
    }
    const siblings = childrenByParentId.get(parent.sessionId) ?? []
    siblings.push(file)
    childrenByParentId.set(parent.sessionId, siblings)
  }

  return roots.map((root) => walkChain(root, childrenByParentId))
}

// Assemble one root's linear resume chain root → leaf. A fork (more than one child of a
// parent) keeps the first and ignores the rest, so the result is always deterministic.
function walkChain(
  root: ParsedTranscript,
  childrenByParentId: Map<string, ParsedTranscript[]>,
): LogicalSession {
  const files: ParsedTranscript[] = [root]
  let current = root
  for (;;) {
    const next = childrenByParentId.get(current.sessionId)?.[0]
    if (next === undefined) break
    files.push(next)
    current = next
  }
  return { id: root.sessionId, fileIds: files.map((file) => file.sessionId), files }
}

// Scan a chain leaf → root and take the first present value, so the most recent file wins with
// earlier files as fallback — the recency rule every per-Session field derivation shares.
export function latestInChain<T>(
  files: ParsedTranscript[],
  select: (file: ParsedTranscript) => T | null,
): T | null {
  for (let index = files.length - 1; index >= 0; index -= 1) {
    const value = select(files[index])
    if (value !== null) return value
  }
  return null
}

// Reduce a numeric reading over the WHOLE chain. Recency is a max, not a chain position: a
// leaf file can be the older one (it is created on resume, then sat on), so scanning for the
// leaf-most present value would report a stale reading as the newest.
export function maxInChain(
  files: ParsedTranscript[],
  select: (file: ParsedTranscript) => number | null,
): number | null {
  let highest: number | null = null
  for (const file of files) {
    const value = select(file)
    if (value !== null && (highest === null || value > highest)) highest = value
  }
  return highest
}

// Scan a chain root → leaf and take the first present value — the mirror of `latestInChain`, for
// a field whose EARLIEST reading is the true one (when the Session began, not where it is now).
export function firstInChain<T>(
  files: ParsedTranscript[],
  select: (file: ParsedTranscript) => T | null,
): T | null {
  for (const file of files) {
    const value = select(file)
    if (value !== null) return value
  }
  return null
}

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

  // Roots first, then anything no chain reached. A file can have a parent and still never be
  // walked — two files naming each other's uuids give a component with no root at all — and dropping
  // those is a session that exists on disk and nowhere in the rail.
  const claimed = new Set<string>()
  const sessions: LogicalSession[] = []
  for (const file of [...roots, ...parsed]) {
    if (claimed.has(file.sessionId)) continue
    sessions.push(walkChain(file, childrenByParentId, claimed))
  }
  return sessions
}

// Assemble one root's linear resume chain root → leaf. A fork (more than one child of a
// parent) keeps the first and ignores the rest, so the result is always deterministic.
//
// A file ALREADY CLAIMED by a chain ends this one. The pointers come from files a model wrote, so
// nothing guarantees they form a tree: two files can name each other's uuids, and the unguarded walk
// then pushed the same pair forever until the array itself overflowed (`RangeError: Invalid array
// length`, thrown inside the observer's publish and taking every later reading with it).
function walkChain(
  root: ParsedTranscript,
  childrenByParentId: Map<string, ParsedTranscript[]>,
  claimed: Set<string>,
): LogicalSession {
  const files: ParsedTranscript[] = [root]
  claimed.add(root.sessionId)
  let current = root
  for (;;) {
    const next = childrenByParentId.get(current.sessionId)?.[0]
    if (next === undefined || claimed.has(next.sessionId)) break
    files.push(next)
    claimed.add(next.sessionId)
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

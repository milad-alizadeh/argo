// Stitching transcript FILES into Sessions. One Session is one logical resume-chain
// (CONTEXT.md L2 · Session): a file links to what it resumed through the `leafUuid` its first
// `last-prompt` record names, and where a relocation left no shared uuid the only shared key is
// the origin `session_id` every message-bearing record carries.
import type { TranscriptFile } from './transcript'

export type SessionChain = {
  // The chain's stable id: the id of its origin file. Every other member id is retired.
  id: string
  retiredIds: string[]
  // Oldest link first, so the Feed reads in the order the work happened.
  files: TranscriptFile[]
  // The origin file names a predecessor that is not in the set read. A Roster pass reads the most
  // recent files only, so a long-running chain can arrive without its own beginning: this chain is
  // then a resumed half standing under a retired id, with a partial history and its own first
  // prompt as a title. Stated rather than smoothed over, because the alternative is drawing a
  // Session as an origin it is not.
  originUnread: boolean
}

// Every uuid a file names, whatever the record carrying it. A resume can be opened on a record
// this slice draws nothing from, so a map built from message records alone would read a file that
// opened on its OWN first line as one that resumed a file nobody read.
function ownerOfEachUuid(files: TranscriptFile[]): Map<string, string> {
  const owners = new Map<string, string>()
  for (const file of files) {
    for (const record of file.records) {
      if (record.kind === 'message' || record.kind === 'trace') {
        owners.set(record.uuid, file.sessionId)
      }
    }
  }
  return owners
}

// The immediate link, and the reason the two keys are not interchangeable: `leafUuid` names the
// PREDECESSOR, `session_id` names the chain's ORIGIN. Where both are readable the leaf wins.
function parentOf(file: TranscriptFile, owners: Map<string, string>, known: Set<string>) {
  const byLeaf = file.resumedFrom === null ? undefined : owners.get(file.resumedFrom)
  if (byLeaf !== undefined && byLeaf !== file.sessionId) return byLeaf
  const origin = file.originSessionId
  if (origin !== null && origin !== file.sessionId && known.has(origin)) return origin
  return null
}

// Walking to the root rather than following one link, so a chain of three resumes lands on one
// id. The seen-set is the cycle guard: two files naming each other would otherwise never end.
function rootOf(start: string, parents: Map<string, string>): string {
  const seen = new Set<string>([start])
  let current = start
  for (;;) {
    const next = parents.get(current)
    if (next === undefined || seen.has(next)) return current
    seen.add(next)
    current = next
  }
}

// A file that links somewhere and lands nowhere. Distinct from a real origin, which links to
// nothing at all, and the two are only tellable apart before the parent map has forgotten which
// is which.
function resumedFromUnread(
  file: TranscriptFile,
  owners: Map<string, string>,
  known: Set<string>,
): boolean {
  if (parentOf(file, owners, known) !== null) return false
  if (file.resumedFrom !== null && !owners.has(file.resumedFrom)) return true
  const origin = file.originSessionId
  return origin !== null && origin !== file.sessionId && !known.has(origin)
}

function orderedByTime(files: TranscriptFile[]): TranscriptFile[] {
  return [...files].sort((left, right) => left.openedAt.localeCompare(right.openedAt))
}

export function stitchChains(files: TranscriptFile[]): SessionChain[] {
  const owners = ownerOfEachUuid(files)
  const known = new Set(files.map((file) => file.sessionId))
  const parents = new Map<string, string>()
  for (const file of files) {
    const parent = parentOf(file, owners, known)
    if (parent !== null) parents.set(file.sessionId, parent)
  }
  const grouped = new Map<string, TranscriptFile[]>()
  for (const file of files) {
    const root = rootOf(file.sessionId, parents)
    grouped.set(root, [...(grouped.get(root) ?? []), file])
  }
  return [...grouped].map(([id, members]) => {
    const origin = members.find((file) => file.sessionId === id)
    return {
      id,
      retiredIds: members.map((file) => file.sessionId).filter((sessionId) => sessionId !== id),
      files: orderedByTime(members),
      originUnread: origin !== undefined && resumedFromUnread(origin, owners, known),
    }
  })
}

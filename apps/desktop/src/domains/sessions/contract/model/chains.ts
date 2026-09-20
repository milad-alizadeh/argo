// Stitching transcript FILES into Sessions. One Session is one logical resume-chain
// (CONTEXT.md L2 · Session): a file links to what it resumed through the `leafUuid` its first
// `last-prompt` record names, and where a relocation left no shared uuid the only shared key is
// the origin `session_id` every message-bearing record carries.
import type { TranscriptFile } from '@/domains/sessions/contract/model/transcript'

export type SessionChain = {
  // The chain's stable id: the id of its origin file. Every other member id is retired.
  id: string
  retiredIds: string[]
  // Oldest link first, so the Feed reads in the order the work happened.
  files: TranscriptFile[]
  // The origin file names a predecessor that is not in the set read. A Roster pass reads the most
  // recent files only, so a long-running chain can arrive without its own beginning: this chain is
  // then a resumed half standing under a retired id, with a partial history. Its title still comes
  // from the ledger's strongest remembered record for that id (#2290), not from this half alone.
  // Stated rather than smoothed over, because the alternative is drawing a Session as an origin it
  // is not.
  originUnread: boolean
}

// What a caller has learned across earlier `stitchChains` calls: which session ids exist, and
// which immediate parent each one resumes. A resume link, once read off a file, never changes
// (files are immutable), so this is safe to grow forever and reuse. Passing it back in keeps a
// chain's `id` stable when a later, narrower page of files no longer includes the origin that
// established it (#2290): without it, `parentOf` would call the origin unknown and promote the
// resumed file to root, which is the roster-reorder and lost-title fault.
export type ChainHistory = {
  knownIds: Set<string>
  parents: Map<string, string>
}

export function createChainHistory(): ChainHistory {
  return { knownIds: new Set(), parents: new Map() }
}

// Every uuid a file names, whatever the record carrying it. A resume can be opened on a record
// this slice draws nothing from, so a map built from message records alone would read a file that
// opened on its OWN first line as one that resumed a file nobody read.
function ownerOfEachUuid(files: TranscriptFile[]): Map<string, string> {
  const owners = new Map<string, string>()
  for (const file of files) {
    for (const record of file.records) {
      if ('uuid' in record) owners.set(record.uuid, file.sessionId)
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
// Exported so a caller holding only the persisted resume graph (#2374) can resolve an arbitrary
// id, current or retired, to its chain without re-stitching any file.
export function rootOf(start: string, parents: Map<string, string>): string {
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

// The caller hands back the same TranscriptFile objects while a file's mtime is unchanged, so
// identity alone says whether anything worth re-stitching happened. A Roster poll runs twice a
// second and stitching walks every record of every file it was given (#2241).
//
// `history` is shared with every other cache a discoverer runs, so a Session opened on demand and
// one seen by the Roster's own poll agree on the same id (#2290).
export function createChainCache(history: ChainHistory = createChainHistory()) {
  let read: TranscriptFile[] = []
  let chains: SessionChain[] = []
  return function stitched(files: TranscriptFile[]): SessionChain[] {
    if (files.length === read.length && files.every((file, index) => file === read[index])) {
      return chains
    }
    read = files
    chains = stitchChains(files, history)
    return chains
  }
}

export function stitchChains(
  files: TranscriptFile[],
  history: ChainHistory = createChainHistory(),
): SessionChain[] {
  const owners = ownerOfEachUuid(files)
  for (const file of files) history.knownIds.add(file.sessionId)
  const known = history.knownIds
  for (const file of files) {
    const parent = parentOf(file, owners, known)
    if (parent !== null) history.parents.set(file.sessionId, parent)
  }
  const parents = history.parents
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
      originUnread: origin === undefined || resumedFromUnread(origin, owners, known),
    }
  })
}

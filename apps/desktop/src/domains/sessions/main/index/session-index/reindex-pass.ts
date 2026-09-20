// What one pass does with the files whose identity moved: parse them, pull in the rest of each
// chain they belong to, and write the whole re-stitched result back to the index (#2372). Split
// from `indexed-window.ts` so reading the window stays readable beside it.
import type { TranscriptFile } from '@/domains/sessions/contract/model/transcript'
import {
  type IndexedTranscriptFile,
  NO_CHAIN,
  type SessionIndex,
  type TranscriptFileIdentity,
  type TranscriptPath,
} from '@/domains/sessions/main/index/session-index/contract'
import type { IndexedWindowSource } from '@/domains/sessions/main/index/session-index/indexed-window'
import {
  chainIdByPath,
  type FileIdentities,
  holdsMessage,
  identitiesOf,
  indexedChains,
  indexedFiles,
  isUnchanged,
  pathOfIndexed,
} from '@/domains/sessions/main/index/session-index/window-pass'

export type Reindexed = {
  owners: Map<string, string>
  files: TranscriptFile[]
  parsedPaths: string[]
  unreadablePaths: string[]
}

export const NOTHING_REINDEXED: Reindexed = {
  owners: new Map(),
  files: [],
  parsedPaths: [],
  unreadablePaths: [],
}

type Pass = { source: IndexedWindowSource; index: SessionIndex }

// A changed file re-stitches its whole chain, so every other member the index knows is parsed
// with it. Growing until the set settles covers a change that joins two chains into one.
async function withChainSiblings(
  pass: Pass,
  opened: Map<string, TranscriptPath>,
  known: Iterable<string>,
) {
  const wanted = new Set([...known].filter((id) => id !== NO_CHAIN))
  const files: TranscriptFile[] = []
  const unreadablePaths: string[] = []
  for (;;) {
    const held = await pass.index.filesOfChains(pass.source.harness, [...wanted])
    const siblings = held.map(pathOfIndexed).filter((file) => !opened.has(file.path))
    if (siblings.length === 0) return { files, unreadablePaths, wanted }
    for (const sibling of siblings) opened.set(sibling.path, sibling)
    const read = await pass.source.readTranscripts(siblings)
    files.push(...read.files)
    unreadablePaths.push(...read.unreadablePaths)
    for (const chain of pass.source.stitch(files)) wanted.add(chain.id)
  }
}

export async function reindexChanged(
  pass: Pass,
  changed: readonly TranscriptFileIdentity[],
  known: { held: ReadonlyMap<string, IndexedTranscriptFile>; identities: FileIdentities },
): Promise<Reindexed> {
  const opened = new Map(
    changed.map((file) => [file.path, { path: file.path, sessionId: file.sessionId }]),
  )
  const first = await pass.source.readTranscripts([...opened.values()])
  const startedChains = pass.source.stitch(first.files).map((chain) => chain.id)
  const heldChains = changed.flatMap((file) => {
    const chainId = known.held.get(file.path)?.chainId
    return chainId === undefined ? [] : [chainId]
  })
  // A chain standing under a retired id joins its origin only in a stitch that reads both, and
  // nothing says which arriving file is that origin. There are few of them, so every pass that
  // parses anything re-stitches them all and lets `stitchChains` decide (#2290).
  const stranded = await pass.index.strandedChains(pass.source.harness)
  const sibling = await withChainSiblings(pass, opened, [
    ...startedChains,
    ...heldChains,
    ...stranded,
  ])
  const parsed = [...first.files, ...sibling.files]
  const chains = pass.source.stitch(parsed.filter(holdsMessage))
  const owners = chainIdByPath(chains)
  const unreadablePaths = [...first.unreadablePaths, ...sibling.unreadablePaths]
  const surviving = new Set(chains.map((chain) => chain.id))
  await pass.index.write(pass.source.harness, {
    files: indexedFiles(parsed, known.identities, owners),
    chains: indexedChains(chains, pass.source.project),
    retiredChainIds: [...sibling.wanted].filter((chainId) => !surviving.has(chainId)),
    links: parsed.map((file) => ({
      sessionId: file.sessionId,
      parentSessionId: pass.source.history.parents.get(file.sessionId) ?? null,
    })),
    // Unreadable AND no longer in the listing is gone. Unreadable alone is a transient failure
    // (EMFILE, a half-written line), and forgetting it would serve a chain missing a live member.
    removedPaths: unreadablePaths.filter((path) => !known.identities.has(path)),
  })
  return { owners, files: parsed, parsedPaths: [...opened.keys()], unreadablePaths }
}

// What every caller of `reindexChanged` must do first: ask the index what it already holds for a
// set of candidate files, and reindex only the ones whose identity moved. The bounded window,
// backfill and reconciliation all read a different slice of the tree but share this one step, so
// each treats "unseen" and "changed" the same way (#2373).
export async function reindexCandidates(
  pass: Pass,
  candidates: readonly TranscriptFileIdentity[],
  listing: readonly TranscriptFileIdentity[],
): Promise<Reindexed & { held: ReadonlyMap<string, IndexedTranscriptFile> }> {
  if (candidates.length === 0) return { ...NOTHING_REINDEXED, held: new Map() }
  const found = await pass.index.filesAt(
    pass.source.harness,
    candidates.map((file) => file.path),
  )
  const held = new Map(found.map((file) => [file.path, file]))
  const changed = candidates.filter((file) => !isUnchanged(held.get(file.path), file))
  if (changed.length === 0) return { ...NOTHING_REINDEXED, held }
  const reindexed = await reindexChanged(pass, changed, { held, identities: identitiesOf(listing) })
  return { ...reindexed, held }
}

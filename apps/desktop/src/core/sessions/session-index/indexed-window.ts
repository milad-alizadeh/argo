// Reading the bounded recent window through the Session index (#2372). A pass enumerates and
// stats the window — which opens no transcript — asks the index what it already holds for those
// paths, and parses only the files whose identity changed, together with the rest of each chain
// they belong to. Everything else is answered from the stored projections, so a warm read opens
// no unchanged transcript file.
import type { ChainHistory, SessionChain } from '../chains'
import type { SessionRosterRow } from '../models'
import type { TranscriptFile } from '../transcript'
import type { SessionIndex, TranscriptFileIdentity, TranscriptPath } from './contract'
import { NOTHING_REINDEXED, reindexChanged } from './reindex-pass'
import { chainsInWindow, identitiesOf, isUnchanged } from './window-pass'

export type ReadTranscripts = (
  paths: readonly TranscriptPath[],
) => Promise<{ files: TranscriptFile[]; unreadablePaths: string[] }>

export type IndexedWindowSource = {
  cli: string
  // Enumerate every transcript and stat it, newest first. Opens none of them.
  identities: (root: string) => Promise<TranscriptFileIdentity[]>
  readTranscripts: ReadTranscripts
  stitch: (files: TranscriptFile[]) => SessionChain[]
  project: (chain: SessionChain) => SessionRosterRow
  // Shared with the adapter's other caches, so a chain keeps one id wherever it is read (#2290).
  history: ChainHistory
}

export type IndexedWindow = {
  rows: SessionRosterRow[]
  filesFound: number
  filesRead: number
  filesUnreadable: number
  // Transcript files this pass opened. Zero on a warm read.
  filesParsed: number
}

export function createIndexedWindow(source: IndexedWindowSource, index: SessionIndex) {
  const pass = { source, index }
  // The promise rather than a flag it sets: two passes can overlap, and a flag set before the
  // await lets the second stitch against a history the first has not filled yet.
  let hydration: Promise<void> | null = null

  // Every resume link the index holds, back into the shared chain history. A link never changes,
  // so this is what keeps a chain's id stable across a restart rather than promoting a resumed
  // half to a root the moment its origin falls outside the window (#2290).
  async function hydrate() {
    for (const link of await index.chainLinks(source.cli)) {
      source.history.knownIds.add(link.sessionId)
      const parent = link.parentSessionId
      if (parent !== null) source.history.parents.set(link.sessionId, parent)
    }
  }

  return async function readWindow(root: string, windowSize: number): Promise<IndexedWindow> {
    const listing = await source.identities(root)
    const window = listing.slice(0, windowSize)
    hydration ??= hydrate()
    await hydration
    const found = await index.filesAt(
      source.cli,
      window.map((file) => file.path),
    )
    const held = new Map(found.map((file) => [file.path, file]))
    const changed = window.filter((file) => !isUnchanged(held.get(file.path), file))
    const reindexed =
      changed.length === 0
        ? NOTHING_REINDEXED
        : await reindexChanged(pass, changed, { held, identities: identitiesOf(listing) })
    const unreadable = window.filter((file) => reindexed.unreadablePaths.includes(file.path)).length
    return {
      rows: await index.rowsOfChains(source.cli, chainsInWindow(window, held, reindexed.owners)),
      filesFound: listing.length,
      filesRead: window.length - unreadable,
      filesUnreadable: unreadable,
      filesParsed: reindexed.parsedPaths.length,
    }
  }
}

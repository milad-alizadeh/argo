// Reading the bounded recent window through the Session index (#2372). A pass enumerates and
// stats the window — which opens no transcript — asks the index what it already holds for those
// paths, and parses only the files whose identity changed, together with the rest of each chain
// they belong to. Everything else is answered from the stored projections, so a warm read opens
// no unchanged transcript file.
import type { ChainHistory, SessionChain } from '@/domains/sessions/contract/chains'
import type { SessionRosterRow } from '@/domains/sessions/contract/models'
import type { TranscriptFile } from '@/domains/sessions/contract/transcript'
import type { SessionIndex, TranscriptFileIdentity, TranscriptPath } from './contract'
import { reindexCandidates } from './reindex-pass'
import { chainsInWindow } from './window-pass'

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

// The bounded window and background backfill/reconcile (#2373) all stitch against the same
// adapter's `ChainHistory`, so all three share one hydration rather than each racing to fill it.
export type IndexedHistory = { ensureHydrated: () => Promise<void> }

export function hydratedHistory(source: IndexedWindowSource, index: SessionIndex): IndexedHistory {
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

  return {
    ensureHydrated: async () => {
      hydration ??= hydrate()
      await hydration
    },
  }
}

export function createIndexedWindow(source: IndexedWindowSource, index: SessionIndex) {
  const pass = { source, index }
  const history = hydratedHistory(source, index)

  async function readWindow(root: string, windowSize: number): Promise<IndexedWindow> {
    const listing = await source.identities(root)
    const window = listing.slice(0, windowSize)
    await history.ensureHydrated()
    const reindexed = await reindexCandidates(pass, window, listing)
    const unreadable = window.filter((file) => reindexed.unreadablePaths.includes(file.path)).length
    return {
      rows: await index.rowsOfChains(
        source.cli,
        chainsInWindow(window, reindexed.held, reindexed.owners),
      ),
      filesFound: listing.length,
      filesRead: window.length - unreadable,
      filesUnreadable: unreadable,
      filesParsed: reindexed.parsedPaths.length,
    }
  }

  // Background backfill and reconciliation (#2373) bind to this same instance so they share its
  // hydration and never re-stitch a resumed half against a history the window read has not filled.
  return { readWindow, ensureHydrated: history.ensureHydrated, pass }
}

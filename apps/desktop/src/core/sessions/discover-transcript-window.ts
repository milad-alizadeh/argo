// Split out of `discover-transcript-sessions.ts` (150-line file ceiling, AGENTS.md): the index-backed
// half of one discoverer's window, kept beside the model it reads but out of the file that builds it.
import type { createChainCache, SessionChain } from './chains'
import { type boundIndexedWindow, discoverIndexedWindow } from './discover-indexed-window'
import type {
  TranscriptDiscovery,
  TranscriptDiscoveryOptions,
} from './discover-transcript-sessions'
import { nextCursorFor, windowSizeFor } from './discover-transcript-sessions'
import type { SessionRosterRow } from './models'
import { type ResolvedIndexedIds, resolveIndexedIds } from './resolve-indexed-ids'
import type { SessionIndex } from './session-index/contract'
import { holdsMessage } from './session-index/window-pass'
import type { createTranscriptSummariser, TranscriptDiscoverySource } from './transcript-window'

// Archive and restore (#2374) resolve an id straight off the index's persisted resume graph
// rather than growing a discovery window to find it.
export function resolveIdsAgainst(
  indexedWindowFor: ReturnType<typeof boundIndexedWindow>,
  index: SessionIndex,
  ids: readonly string[],
): Promise<ResolvedIndexedIds> {
  return resolveIndexedIds(indexedWindowFor(index), index, ids)
}

export async function historyCompleteFor(cli: string, index: SessionIndex): Promise<boolean> {
  return (await index.backfillProgress(cli)).complete
}

export async function discoverSessionsWith(
  parts: {
    source: TranscriptDiscoverySource
    summarise: ReturnType<typeof createTranscriptSummariser>
    rosterChains: ReturnType<typeof createChainCache>
    projectChain: (chain: SessionChain) => SessionRosterRow
    presented: (rows: SessionRosterRow[]) => SessionRosterRow[]
    indexedWindowFor: ReturnType<typeof boundIndexedWindow>
  },
  root: string,
  options?: TranscriptDiscoveryOptions,
): Promise<TranscriptDiscovery> {
  const { source, summarise, rosterChains, projectChain, presented, indexedWindowFor } = parts
  const windowSize = windowSizeFor(options?.cursor)
  const index = options?.index
  if (index !== undefined) {
    return discoverIndexedWindow({
      root,
      windowSize,
      index,
      cli: source.cli,
      indexedWindowFor,
      presented,
    })
  }
  const { found, files, unreadable } = await summarise(root, windowSize)
  return {
    rows: presented(rosterChains(files.filter(holdsMessage)).map(projectChain)),
    filesFound: found.length,
    filesRead: files.length,
    filesUnreadable: unreadable,
    filesParsed: files.length,
    nextCursor: nextCursorFor(found.length, windowSize),
    historyComplete: true,
  }
}

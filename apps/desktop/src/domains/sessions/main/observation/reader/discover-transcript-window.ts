// Split out of `discover-transcript-sessions.ts` (150-line file ceiling, AGENTS.md): the index-backed
// half of one discoverer's window, kept beside the model it reads but out of the file that builds it.
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import type {
  createChainCache,
  SessionChain,
} from '@/domains/sessions/contract/model/transcript/chains'
import {
  type boundIndexedWindow,
  discoverIndexedWindow,
} from '../../indexing/discover-indexed-window'
import { type ResolvedIndexedIds, resolveIndexedIds } from '../../indexing/resolve-indexed-ids'
import type { SessionIndex } from '../../indexing/session-index/contract'
import { isSessionIndexFallback } from '../../indexing/session-index/recovery'
import { holdsMessage } from '../../indexing/session-index/window-pass'
import type {
  createTranscriptSummariser,
  TranscriptDiscoverySource,
} from '../tail/transcript-window'
import type {
  TranscriptDiscovery,
  TranscriptDiscoveryOptions,
} from './discover-transcript-sessions'
import { nextCursorFor, windowSizeFor } from './discover-transcript-sessions'

// Archive and restore (#2374) resolve an id straight off the index's persisted resume graph
// rather than growing a discovery window to find it.
export function resolveIdsAgainst(
  indexedWindowFor: ReturnType<typeof boundIndexedWindow>,
  index: SessionIndex,
  ids: readonly string[],
): Promise<ResolvedIndexedIds> {
  return resolveIndexedIds(indexedWindowFor(index), index, ids)
}

export async function historyCompleteFor(harness: string, index: SessionIndex): Promise<boolean> {
  return (await index.backfillProgress(harness)).complete
}

// Every chain the index's title, id, and retired-id columns match, presented the same way a
// window's rows are: the strongest known title, newest first (#2375). Reads no transcript, so it
// covers whatever history background backfill has already reached rather than the loaded window.
export async function searchAgainst(options: {
  index: SessionIndex
  harness: string
  query: string
  presented: (rows: SessionRosterRow[]) => SessionRosterRow[]
}): Promise<SessionRosterRow[]> {
  const { index, harness, query, presented } = options
  return presented(await index.searchChains(harness, query))
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
    try {
      return await discoverIndexedWindow({
        root,
        windowSize,
        index,
        harness: source.harness,
        indexedWindowFor,
        presented,
      })
    } catch (error) {
      if (!isSessionIndexFallback(error)) throw error
    }
  }
  const { found, files, unreadable } = await summarise(root, windowSize)
  return {
    rows: presented(rosterChains(files.filter(holdsMessage)).map(projectChain)),
    filesFound: found.length,
    filesRead: files.length,
    filesUnreadable: unreadable,
    filesParsed: files.length,
    nextCursor: nextCursorFor(found.length, windowSize),
    historyComplete: index === undefined,
  }
}

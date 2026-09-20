import type { createChainCache, SessionChain } from '@/domains/sessions/contract/model/chains'
import { currentSessionId } from '@/domains/sessions/contract/model/models'
import type { createFullRecordTracker } from '@/domains/sessions/main/index/full-record-tracker'
import type { SessionIndex } from '@/domains/sessions/main/index/session-index/contract'
import type { createIndexedWindow } from '@/domains/sessions/main/index/session-index/indexed-window'
import { isSessionIndexFallback } from '@/domains/sessions/main/index/session-index/recovery'
import { readIndexedChain } from '@/domains/sessions/main/observation/read-indexed-chain'
import type {
  createTranscriptSummariser,
  TranscriptDiscoverySource,
} from '@/domains/sessions/main/observation/transcript-window'
import { ROSTER_PAGE_SIZE } from './roster-page-size'

export type ChainReaderParts = {
  source: TranscriptDiscoverySource
  summarise: ReturnType<typeof createTranscriptSummariser>
  chains: ReturnType<typeof createChainCache>
  tracker: ReturnType<typeof createFullRecordTracker>
  indexedWindowFor: (index: SessionIndex) => ReturnType<typeof createIndexedWindow>
}

// The whole-tree walk: the window grows by the same step discovery pages by until the id resolves
// or every file has been read (#2239). This is what an index cannot yet answer falls back to.
async function pageForChain(
  parts: ChainReaderParts,
  root: string,
  sessionId: string,
): Promise<SessionChain | null> {
  // Every chain id and retired id is some file's own id, so an id no file is named for resolves
  // nowhere. A Session its Harness has not written yet is answered from the listing alone (#2356).
  const named = await parts.source.transcriptPaths(root)
  if (!named.some((file) => file.sessionId === sessionId)) return null
  let windowSize = ROSTER_PAGE_SIZE
  for (;;) {
    const { found, files } = await parts.summarise(root, windowSize)
    const chains = parts.chains(files)
    const currentId = currentSessionId(chains, sessionId)
    const chain = chains.find((candidate) => candidate.id === currentId)
    if (chain !== undefined) return { ...chain, files: await parts.tracker.readChainFiles(chain) }
    if (found.length <= windowSize) return null
    windowSize += ROSTER_PAGE_SIZE
  }
}

// A Session already known by id is found however far back it sits: the window grows by the same
// step discovery pages by until the id resolves or every file has been read (#2239). Opening a
// Session this way is a bounded, on-demand read of exactly as much history as that Session needed,
// never the unconditional whole-tree read the Roster's own passes must not make.
//
// An index that has already stitched the Session answers directly instead (#2507): `index` is
// threaded in per call, from the caller's own port, rather than held on the discoverer, because
// the discoverer is built once while the app's Session index arrives only once main storage opens.
export function createChainReader(parts: ChainReaderParts) {
  return async function readSessionFiles(root: string, sessionId: string, index?: SessionIndex) {
    if (index !== undefined) {
      // A busy or damaged index (`recoverableIndexOperation`) falls back to the paging walk below,
      // exactly as the bounded Roster window does for the same fault (#2372).
      let indexed: SessionChain | null | undefined
      try {
        indexed = await readIndexedChain({
          tracker: parts.tracker,
          indexedWindowFor: parts.indexedWindowFor,
          index,
          sessionId,
        })
      } catch (error) {
        if (!isSessionIndexFallback(error)) throw error
      }
      if (indexed !== undefined) return indexed
    }
    return pageForChain(parts, root, sessionId)
  }
}

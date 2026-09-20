import {
  createChainCache,
  createChainHistory,
  type SessionChain,
} from '@/domains/sessions/contract/model/chains'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import type { TranscriptFile } from '@/domains/sessions/contract/model/transcript'
import {
  boundIndexedWindow,
  presentedRows,
} from '@/domains/sessions/main/index/discover-indexed-window'
import { createFullRecordTracker } from '@/domains/sessions/main/index/full-record-tracker'
import { createBackgroundIndexing } from '@/domains/sessions/main/index/session-index/background-indexing'
import type {
  BackfillProgress,
  SessionIndex,
  TranscriptPath,
} from '@/domains/sessions/main/index/session-index/contract'
import { createTitleLedger } from '@/domains/sessions/main/lifecycle/title-ledger'
import { createChainReader } from '@/domains/sessions/main/observation/chain-reader'
import {
  discoverSessionsWith,
  historyCompleteFor,
  resolveIdsAgainst,
  searchAgainst,
} from '@/domains/sessions/main/observation/discover-transcript-window'
import { ROSTER_PAGE_SIZE } from '@/domains/sessions/main/observation/roster-page-size'
import {
  createFileReader,
  createTranscriptParser,
  createTranscriptSummariser,
  type TranscriptDiscoverySource,
  transcriptIdentities,
} from '@/domains/sessions/main/observation/transcript-window'
import { projectRosterRow } from '@/domains/sessions/main/projection/roster'
import { rosterMetadata } from '@/domains/sessions/main/projection/roster-metadata'

export type { TranscriptPath }
export { ROSTER_PAGE_SIZE }

export type TranscriptDiscovery = {
  rows: SessionRosterRow[]
  filesFound: number
  filesRead: number
  filesUnreadable: number
  // Transcript files this pass opened, as against the window it covered. Zero on a warm read
  // through the Session index, and the same as `filesRead` without one (#2372).
  filesParsed: number
  // A larger window would find more Sessions, encoded as how many files the next pass should
  // read; null once every file `transcriptPaths` found is already inside the window (#2239).
  nextCursor: string | null
  // False while background backfill still has older history left to index (#2373), so a caller
  // never reads a Session index still catching up as the machine's whole history. Always true
  // without an index: that path reads every file this call asked for directly.
  historyComplete: boolean
}

// A cursor names how many of the most-recently-written files the pass should read, encoded as a
// string so the reader treats it as opaque. `null` is the cold-cache first page.
export function windowSizeFor(cursor: string | null | undefined): number {
  if (cursor === null || cursor === undefined) return ROSTER_PAGE_SIZE
  const parsed = Number.parseInt(cursor, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : ROSTER_PAGE_SIZE
}

export function nextCursorFor(found: number, windowSize: number): string | null {
  return found > windowSize ? String(windowSize + ROSTER_PAGE_SIZE) : null
}

// The metadata projection every Roster pass reads: the same records, with everything the Roster
// does not draw dropped before a chain is ever stitched.
function metadataSourceOf(source: TranscriptDiscoverySource): TranscriptDiscoverySource {
  return {
    ...source,
    parse: (line) => {
      const record = source.parse(line)
      return record === null ? null : rosterMetadata(record)
    },
  }
}

// Where the Session index reaches one adapter's discovery. It arrives per call rather than at
// construction because each adapter's discoverer is one long-lived instance holding the chain
// history and the full-record tracker, while the index is the app's and is built later (#2372).
export type TranscriptDiscoveryOptions = { cursor?: string | null; index?: SessionIndex }

export function createTranscriptDiscoverer(source: TranscriptDiscoverySource) {
  const tracker = createFullRecordTracker(source.parse, source.normalizeRecords)
  const metadataSource = metadataSourceOf(source)
  const readFile = createFileReader(metadataSource)
  const readFullFile = createFileReader(source)
  const summarise = createTranscriptSummariser(metadataSource, readFile)
  const chainHistory = createChainHistory()
  const rosterChains = createChainCache(chainHistory)
  const sessionChains = createChainCache(chainHistory)
  const strongestTitle = createTitleLedger()
  const presented = (rows: SessionRosterRow[]) => presentedRows(strongestTitle, rows)
  const projectChain = (chain: SessionChain) => projectRosterRow(chain, source.harness)

  const windowSource = {
    harness: source.harness,
    identities: (root: string) => transcriptIdentities(metadataSource, root),
    // The roster projection stays metadata-only, but the rebuildable index also carries the Feed
    // text search projection. It therefore parses the same normalized records the Feed reader
    // would render, never raw transcript JSON.
    readTranscripts: createTranscriptParser(readFullFile),
    stitch: (files: TranscriptFile[]) => rosterChains(files),
    project: projectChain,
    history: chainHistory,
  }
  const indexedWindowFor = boundIndexedWindow(windowSource)

  const discoverSessions = (root: string, options?: TranscriptDiscoveryOptions) =>
    discoverSessionsWith(
      { source, summarise, rosterChains, projectChain, presented, indexedWindowFor },
      root,
      options,
    )

  const readSessionFiles = createChainReader({
    source,
    summarise,
    chains: sessionChains,
    tracker,
    indexedWindowFor,
  })

  // Background backfill and reconcile (#2373) share this same bound index's hydration, so a
  // resumed half never re-stitches against a history the window read has not filled.
  const background = createBackgroundIndexing(windowSource, indexedWindowFor)

  return {
    clearFullRecords: tracker.clearFullRecords,
    discoverSessions,
    readSessionFiles,
    backfillTick: (root: string, index: SessionIndex, batchSize = ROSTER_PAGE_SIZE) =>
      background.backfillTick(root, index, batchSize),
    reconcileAll: background.reconcileAll,
    resolveIds: (index: SessionIndex, ids: readonly string[]) =>
      resolveIdsAgainst(indexedWindowFor, index, ids),
    historyComplete: (index: SessionIndex) => historyCompleteFor(source.harness, index),
    searchIndexed: (index: SessionIndex, query: string) =>
      searchAgainst({ index, harness: source.harness, query, presented }),
  }
}

export type { BackfillProgress }

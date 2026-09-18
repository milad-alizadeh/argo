import { createChainCache, createChainHistory, type SessionChain } from './chains'
import { boundIndexedWindow, presentedRows } from './discover-indexed-window'
import {
  discoverSessionsWith,
  historyCompleteFor,
  resolveIdsAgainst,
  searchAgainst,
} from './discover-transcript-window'
import { createFullRecordTracker } from './full-record-tracker'
import type { SessionRosterRow } from './models'
import { currentSessionId } from './models'
import { projectRosterRow } from './roster'
import { rosterMetadata } from './roster-metadata'
import { createBackgroundIndexing } from './session-index/background-indexing'
import type { BackfillProgress, SessionIndex, TranscriptPath } from './session-index/contract'
import { createTitleLedger } from './title-ledger'
import type { TranscriptFile } from './transcript'
import { sessionIdOfFile } from './transcript-file'
import {
  createFileReader,
  createTranscriptParser,
  createTranscriptSummariser,
  type TranscriptDiscoverySource,
  transcriptIdentities,
} from './transcript-window'

export type { TranscriptPath }

// How many transcript files one Roster pass reads, most recently written first, on a cold cursor.
// A later request grows the window by the same step rather than reading the rest of the tree.
// Measured on a real tree of 1,055 files holding 3.3 GB: streaming 50 of them costs about 0.4 s,
// 200 about 1.6 s. The count is stated on the reply rather than hidden, so a Roster that did not
// reach every file says so instead of reading as the whole machine.
export const ROSTER_PAGE_SIZE = 50

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

// A Session already known by id is found however far back it sits: the window grows by the same
// step discovery pages by until the id resolves or every file has been read (#2239). Opening a
// Session this way is a bounded, on-demand read of exactly as much history as that Session needed,
// never the unconditional whole-tree read the Roster's own passes must not make.
function createChainReader(parts: {
  source: TranscriptDiscoverySource
  summarise: ReturnType<typeof createTranscriptSummariser>
  chains: ReturnType<typeof createChainCache>
  tracker: ReturnType<typeof createFullRecordTracker>
}) {
  return async function readSessionFiles(root: string, sessionId: string) {
    // Every chain id and retired id is some file's own id, so an id no file is named for resolves
    // nowhere. A Session its CLI has not written yet is answered from the listing alone (#2356).
    const named = await parts.source.transcriptPaths(root)
    if (!named.some((file) => sessionIdOfFile(file.name) === sessionId)) return null
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
}

export function createTranscriptDiscoverer(source: TranscriptDiscoverySource) {
  const tracker = createFullRecordTracker(source.parse, source.normalizeRecords)
  const metadataSource = metadataSourceOf(source)
  const readFile = createFileReader(metadataSource)
  const summarise = createTranscriptSummariser(metadataSource, readFile)
  const chainHistory = createChainHistory()
  const rosterChains = createChainCache(chainHistory)
  const sessionChains = createChainCache(chainHistory)
  const strongestTitle = createTitleLedger()
  const presented = (rows: SessionRosterRow[]) => presentedRows(strongestTitle, rows)
  const projectChain = (chain: SessionChain) => projectRosterRow(chain, source.cli)

  const windowSource = {
    cli: source.cli,
    identities: (root: string) => transcriptIdentities(metadataSource, root),
    readTranscripts: createTranscriptParser(readFile),
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

  const readSessionFiles = createChainReader({ source, summarise, chains: sessionChains, tracker })

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
    historyComplete: (index: SessionIndex) => historyCompleteFor(source.cli, index),
    searchIndexed: (index: SessionIndex, query: string) =>
      searchAgainst({ index, cli: source.cli, query, presented }),
  }
}

export type { BackfillProgress }

import { stat } from 'node:fs/promises'
import { createChainCache, createChainHistory, type SessionChain } from './chains'
import { createFullRecordTracker } from './full-record-tracker'
import type { SessionRosterRow } from './models'
import { currentSessionId } from './models'
import { projectRosterRow } from './roster'
import { rosterMetadata } from './roster-metadata'
import { createTitleLedger } from './title-ledger'
import {
  type TranscriptFile,
  type TranscriptParser,
  type TranscriptRecord,
  transcriptFileFrom,
} from './transcript'
import { sessionIdOfFile } from './transcript-file'
import { createTranscriptRecordReader } from './transcript-lines'

export type TranscriptPath = { path: string; name: string }

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
  // A larger window would find more Sessions, encoded as how many files the next pass should
  // read; null once every file `transcriptPaths` found is already inside the window (#2239).
  nextCursor: string | null
}

// Size joins mtime in the cache key: a file appended to inside one mtime tick reads as unchanged
// on a filesystem whose timestamps are coarser than the write, and the Roster then stops
// following the transcript (seen on CI, #2241).
type Candidate = TranscriptPath & { writtenAt: number; size: number }

type TranscriptDiscoverySource = {
  cli: string
  transcriptPaths: (root: string) => Promise<TranscriptPath[]>
  parse: TranscriptParser
  normalizeRecords?: (records: TranscriptRecord[]) => TranscriptRecord[]
}

function holdsMessage(file: TranscriptFile): boolean {
  return file.records.some((record) => record.kind === 'message')
}

// A cursor names how many of the most-recently-written files the pass should read, encoded as a
// string so the reader treats it as opaque. `null` is the cold-cache first page.
function windowSizeFor(cursor: string | null | undefined): number {
  if (cursor === null || cursor === undefined) return ROSTER_PAGE_SIZE
  const parsed = Number.parseInt(cursor, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : ROSTER_PAGE_SIZE
}

type ReadFile = (file: TranscriptPath) => Promise<TranscriptFile | null>

function createFileReader(source: TranscriptDiscoverySource): ReadFile {
  const { readRecords } = createTranscriptRecordReader(source.parse)
  return async (file) => {
    try {
      const records = await readRecords(file.path)
      return transcriptFileFrom(file.path, {
        fileName: file.name,
        records: source.normalizeRecords?.(records) ?? records,
      })
    } catch {
      return null
    }
  }
}

function createTranscriptSummariser(source: TranscriptDiscoverySource, readFile: ReadFile) {
  const summaries = new Map<string, { writtenAt: number; size: number; file: TranscriptFile }>()

  return async function summarise(root: string, windowSize: number) {
    const found = await source.transcriptPaths(root)
    const candidates: Candidate[] = await Promise.all(
      found.map(async (file) => {
        const written = await stat(file.path).catch(() => null)
        return { ...file, writtenAt: written?.mtimeMs ?? 0, size: written?.size ?? 0 }
      }),
    )
    candidates.sort((left, right) => right.writtenAt - left.writtenAt)
    const recent = candidates.slice(0, windowSize)
    const files: TranscriptFile[] = []
    let unreadable = 0
    for (const candidate of recent) {
      const held = summaries.get(candidate.path)
      if (
        held !== undefined &&
        held.writtenAt === candidate.writtenAt &&
        held.size === candidate.size
      ) {
        files.push(held.file)
        continue
      }
      const read = await readFile(candidate)
      if (read === null) {
        unreadable += 1
        continue
      }
      summaries.set(candidate.path, {
        writtenAt: candidate.writtenAt,
        size: candidate.size,
        file: read,
      })
      files.push(read)
    }
    const reached = new Set(recent.map((candidate) => candidate.path))
    for (const path of summaries.keys()) if (!reached.has(path)) summaries.delete(path)
    return { found, files, unreadable }
  }
}

export function createTranscriptDiscoverer(source: TranscriptDiscoverySource) {
  const tracker = createFullRecordTracker(source.parse, source.normalizeRecords)
  const metadataSource: TranscriptDiscoverySource = {
    ...source,
    parse: (line) => {
      const record = source.parse(line)
      return record === null ? null : rosterMetadata(record)
    },
  }
  const summarise = createTranscriptSummariser(metadataSource, createFileReader(metadataSource))
  const chainHistory = createChainHistory()
  const rosterChains = createChainCache(chainHistory)
  const sessionChains = createChainCache(chainHistory)
  const strongestTitle = createTitleLedger()

  function rowsFrom(files: TranscriptFile[]): SessionRosterRow[] {
    const rows = rosterChains(files.filter(holdsMessage)).map((chain) =>
      projectRosterRow(chain, source.cli),
    )
    for (const row of rows) row.title = strongestTitle(row.id, row.title)
    rows.sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))
    return rows
  }

  async function discoverSessions(
    root: string,
    options?: { cursor?: string | null },
  ): Promise<TranscriptDiscovery> {
    const windowSize = windowSizeFor(options?.cursor)
    const { found, files, unreadable } = await summarise(root, windowSize)
    const nextCursor = found.length > windowSize ? String(windowSize + ROSTER_PAGE_SIZE) : null
    return {
      rows: rowsFrom(files),
      filesFound: found.length,
      filesRead: files.length,
      filesUnreadable: unreadable,
      nextCursor,
    }
  }

  // A Session already known by id is found however far back it sits: the window grows by the same
  // step discovery pages by until the id resolves or every file has been read (#2239). Opening a
  // Session this way is a bounded, on-demand read of exactly as much history as that Session needed,
  // never the unconditional whole-tree read the Roster's own passes must not make.
  async function readSessionFiles(root: string, sessionId: string): Promise<SessionChain | null> {
    // Every chain id and retired id is some file's own id, so an id no file is named for resolves
    // nowhere. A Session its CLI has not written yet is answered from the listing alone (#2356).
    const named = await source.transcriptPaths(root)
    if (!named.some((file) => sessionIdOfFile(file.name) === sessionId)) return null
    let windowSize = ROSTER_PAGE_SIZE
    for (;;) {
      const { found, files } = await summarise(root, windowSize)
      const chains = sessionChains(files)
      const currentId = currentSessionId(chains, sessionId)
      const chain = chains.find((candidate) => candidate.id === currentId)
      if (chain !== undefined) return { ...chain, files: await tracker.readChainFiles(chain) }
      if (found.length <= windowSize) return null
      windowSize += ROSTER_PAGE_SIZE
    }
  }

  return { clearFullRecords: tracker.clearFullRecords, discoverSessions, readSessionFiles }
}

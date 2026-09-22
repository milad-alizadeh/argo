// Getting transcript files off disk for one adapter: what the tree holds, and what a named set of
// paths parses into. Split from `discover-transcript-sessions.ts` (#2372) so enumerating a file
// and opening it are separate acts — the Session index needs the first without the second.
import { stat } from 'node:fs/promises'
import {
  type TranscriptFile,
  type TranscriptParser,
  type TranscriptRecord,
  transcriptFileFrom,
} from '@/domains/sessions/contract/model/transcript/transcript'
import type { TranscriptFileIdentity, TranscriptPath } from '../../indexing/session-index/contract'
import { createTranscriptRecordReader } from './transcript-lines'

export type TranscriptDiscoverySource = {
  harness: string
  transcriptPaths: (root: string) => Promise<TranscriptPath[]>
  parse: TranscriptParser
  normalizeRecords?: (records: TranscriptRecord[]) => TranscriptRecord[]
}

export type ReadFile = (file: TranscriptPath) => Promise<TranscriptFile | null>

export function createFileReader(source: TranscriptDiscoverySource): ReadFile {
  const { readRecords } = createTranscriptRecordReader(source.parse)
  return async (file) => {
    try {
      const records = await readRecords(file.path)
      return transcriptFileFrom(file.path, {
        sessionId: file.sessionId,
        records: source.normalizeRecords?.(records) ?? records,
      })
    } catch {
      return null
    }
  }
}

// Every transcript in the tree, newest written first, with the identity that says whether it has
// changed. Size joins mtime in that identity: a file appended to inside one mtime tick reads as
// unchanged on a filesystem whose timestamps are coarser than the write, and the Roster then
// stops following the transcript (seen on CI, #2241).
export async function transcriptIdentities(
  source: TranscriptDiscoverySource,
  root: string,
): Promise<TranscriptFileIdentity[]> {
  const found = await source.transcriptPaths(root)
  const identities: TranscriptFileIdentity[] = await Promise.all(
    found.map(async (file) => {
      const written = await stat(file.path).catch(() => null)
      return { ...file, writtenAt: written?.mtimeMs ?? 0, size: written?.size ?? 0 }
    }),
  )
  identities.sort((left, right) => right.writtenAt - left.writtenAt)
  return identities
}

export function createTranscriptParser(readFile: ReadFile) {
  return async function readTranscripts(paths: readonly TranscriptPath[]) {
    const files: TranscriptFile[] = []
    const unreadablePaths: string[] = []
    for (const path of paths) {
      const read = await readFile(path)
      if (read === null) unreadablePaths.push(path.path)
      else files.push(read)
    }
    return { files, unreadablePaths }
  }
}

// The on-demand read path: the window's files, held in memory while their identity is unchanged.
// `readSessionFiles` grows its window until one Session resolves, so the same file is asked for
// repeatedly inside one call and re-reading it each time is the cost this map removes.
export function createTranscriptSummariser(source: TranscriptDiscoverySource, readFile: ReadFile) {
  const summaries = new Map<string, { writtenAt: number; size: number; file: TranscriptFile }>()

  return async function summarise(root: string, windowSize: number) {
    const found = await transcriptIdentities(source, root)
    const recent = found.slice(0, windowSize)
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

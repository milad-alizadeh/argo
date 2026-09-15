import { stat } from 'node:fs/promises'
import { type SessionChain, stitchChains } from './chains'
import type { SessionRosterRow } from './models'
import { currentSessionId } from './models'
import { projectRosterRow } from './roster'
import { rosterMetadata } from './roster-metadata'
import {
  type TranscriptFile,
  type TranscriptParser,
  type TranscriptRecord,
  transcriptFileFrom,
} from './transcript'
import { createTranscriptRecordReader, ROSTER_FILE_LIMIT } from './transcript-lines'

export type TranscriptPath = { path: string; name: string }

export type TranscriptDiscovery = {
  rows: SessionRosterRow[]
  filesFound: number
  filesRead: number
  filesUnreadable: number
}

type Candidate = TranscriptPath & { writtenAt: number }

type TranscriptDiscoverySource = {
  cli: string
  transcriptPaths: (root: string) => Promise<TranscriptPath[]>
  parse: TranscriptParser
  normalizeRecords?: (records: TranscriptRecord[]) => TranscriptRecord[]
}

function holdsMessage(file: TranscriptFile): boolean {
  return file.records.some((record) => record.kind === 'message')
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
  const summaries = new Map<string, { writtenAt: number; file: TranscriptFile }>()

  return async function summarise(root: string) {
    const found = await source.transcriptPaths(root)
    const candidates: Candidate[] = await Promise.all(
      found.map(async (file) => ({
        ...file,
        writtenAt: (await stat(file.path).catch(() => null))?.mtimeMs ?? 0,
      })),
    )
    candidates.sort((left, right) => right.writtenAt - left.writtenAt)
    const recent = candidates.slice(0, ROSTER_FILE_LIMIT)
    const files: TranscriptFile[] = []
    let unreadable = 0
    for (const candidate of recent) {
      const held = summaries.get(candidate.path)
      if (held !== undefined && held.writtenAt === candidate.writtenAt) {
        files.push(held.file)
        continue
      }
      const read = await readFile(candidate)
      if (read === null) {
        unreadable += 1
        continue
      }
      summaries.set(candidate.path, { writtenAt: candidate.writtenAt, file: read })
      files.push(read)
    }
    const reached = new Set(recent.map((candidate) => candidate.path))
    for (const path of summaries.keys()) if (!reached.has(path)) summaries.delete(path)
    return { found, files, unreadable }
  }
}

export function createTranscriptDiscoverer(source: TranscriptDiscoverySource) {
  const fullRecords = createTranscriptRecordReader(source.parse)
  const discardedFullPaths = new Set<string>()
  const fullPaths = new Map<string, string[]>()
  const readFullFile: ReadFile = async (file) => {
    try {
      const records = await fullRecords.readRecords(file.path)
      return transcriptFileFrom(file.path, {
        fileName: file.name,
        records: source.normalizeRecords?.(records) ?? records,
      })
    } catch {
      return null
    }
  }
  const metadataSource: TranscriptDiscoverySource = {
    ...source,
    parse: (line) => {
      const record = source.parse(line)
      return record === null ? null : rosterMetadata(record)
    },
  }
  const summarise = createTranscriptSummariser(metadataSource, createFileReader(metadataSource))

  async function discoverSessions(root: string): Promise<TranscriptDiscovery> {
    const { found, files, unreadable } = await summarise(root)
    const rows = stitchChains(files.filter(holdsMessage)).map((chain) =>
      projectRosterRow(chain, source.cli),
    )
    rows.sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))
    return { rows, filesFound: found.length, filesRead: files.length, filesUnreadable: unreadable }
  }

  async function readSessionFiles(root: string, sessionId: string): Promise<SessionChain | null> {
    const { files } = await summarise(root)
    const chains = stitchChains(files)
    const currentId = currentSessionId(chains, sessionId)
    const chain = chains.find((candidate) => candidate.id === currentId)
    if (chain === undefined) return null
    const paths = chain.files.map((file) => file.path)
    for (const path of paths) discardedFullPaths.delete(path)
    for (const file of chain.files) fullPaths.set(file.sessionId, paths)
    fullPaths.set(chain.id, paths)
    const read = await Promise.all(
      chain.files.map((file) => readFullFile({ path: file.path, name: `${file.sessionId}.jsonl` })),
    )
    if (paths.some((path) => discardedFullPaths.has(path))) fullRecords.clear(paths)
    return { ...chain, files: read.filter((file): file is TranscriptFile => file !== null) }
  }

  function clearFullRecords(sessionId: string) {
    const paths = fullPaths.get(sessionId)
    if (paths === undefined) return
    for (const path of paths) discardedFullPaths.add(path)
    fullRecords.clear(paths)
    for (const [id, remembered] of fullPaths) {
      if (remembered === paths) fullPaths.delete(id)
    }
  }

  return { clearFullRecords, discoverSessions, readSessionFiles }
}

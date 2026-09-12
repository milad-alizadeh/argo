import { stat } from 'node:fs/promises'
import { type SessionChain, stitchChains } from './chains'
import type { SessionRosterRow } from './models'
import { projectRosterRow } from './roster'
import {
  readTranscriptFile,
  type TranscriptFile,
  type TranscriptParser,
  withoutBlocks,
} from './transcript'
import { ROSTER_FILE_LIMIT, readTranscriptLines } from './transcript-lines'

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
}

function holdsMessage(file: TranscriptFile): boolean {
  return file.records.some((record) => record.kind === 'message')
}

async function readFile(
  source: TranscriptDiscoverySource,
  file: TranscriptPath,
): Promise<TranscriptFile | null> {
  try {
    return readTranscriptFile(file.path, {
      fileName: file.name,
      lines: await readTranscriptLines(file.path),
      parse: source.parse,
    })
  } catch {
    return null
  }
}

function createTranscriptSummariser(source: TranscriptDiscoverySource) {
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
      const read = await readFile(source, candidate)
      if (read === null) {
        unreadable += 1
        continue
      }
      const file = withoutBlocks(read)
      summaries.set(candidate.path, { writtenAt: candidate.writtenAt, file })
      files.push(file)
    }
    const reached = new Set(recent.map((candidate) => candidate.path))
    for (const path of summaries.keys()) if (!reached.has(path)) summaries.delete(path)
    return { found, files, unreadable }
  }
}

export function createTranscriptDiscoverer(source: TranscriptDiscoverySource) {
  const summarise = createTranscriptSummariser(source)

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
    const chain = stitchChains(files).find(
      (candidate) => candidate.id === sessionId || candidate.retiredIds.includes(sessionId),
    )
    if (chain === undefined) return null
    const read = await Promise.all(
      chain.files.map((file) =>
        readFile(source, { path: file.path, name: `${file.sessionId}.jsonl` }),
      ),
    )
    return { ...chain, files: read.filter((file): file is TranscriptFile => file !== null) }
  }

  return { discoverSessions, readSessionFiles }
}

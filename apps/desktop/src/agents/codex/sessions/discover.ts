import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { stitchChains } from '../../claude/sessions/chains'
import { ROSTER_FILE_LIMIT, readLines } from '../../claude/sessions/discover'
import { projectRosterRow, type RosterRow } from '../../claude/sessions/roster'
import {
  readTranscriptFile,
  type TranscriptFile,
  withoutBlocks,
} from '../../claude/sessions/transcript-file'
import { parseCodexTranscriptLine } from './records'

export type Discovery = {
  rows: RosterRow[]
  filesFound: number
  filesRead: number
  filesUnreadable: number
}

type Candidate = { path: string; name: string; writtenAt: number }

async function directories(root: string): Promise<string[]> {
  return (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
}

async function transcriptPathsInDay(root: string) {
  return (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map((entry) => ({ path: path.join(root, entry.name), name: entry.name }))
}

async function transcriptPaths(root: string): Promise<{ path: string; name: string }[]> {
  const years = await directories(root)
  const months = (await Promise.all(years.map(directories))).flat()
  const days = (await Promise.all(months.map(directories))).flat()
  return (await Promise.all(days.map(transcriptPathsInDay))).flat()
}

const summaries = new Map<string, { writtenAt: number; file: TranscriptFile }>()

async function summarise(root: string) {
  const found = await transcriptPaths(root)
  const candidates: Candidate[] = await Promise.all(
    found.map(async (file) => ({ ...file, writtenAt: (await stat(file.path)).mtimeMs })),
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
    try {
      const file = withoutBlocks(
        readTranscriptFile(candidate.path, {
          fileName: candidate.name,
          lines: await readLines(candidate.path),
          parse: parseCodexTranscriptLine,
        }),
      )
      summaries.set(candidate.path, { writtenAt: candidate.writtenAt, file })
      files.push(file)
    } catch {
      unreadable += 1
    }
  }
  return { found, files, unreadable }
}

export async function discoverSessions(root: string): Promise<Discovery> {
  const { found, files, unreadable } = await summarise(root)
  const rows = stitchChains(files).map((chain) => projectRosterRow(chain, 'codex'))
  rows.sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))
  return { rows, filesFound: found.length, filesRead: files.length, filesUnreadable: unreadable }
}

export async function readSessionFiles(root: string, sessionId: string) {
  const { files } = await summarise(root)
  const chain = stitchChains(files).find(
    (candidate) => candidate.id === sessionId || candidate.retiredIds.includes(sessionId),
  )
  if (chain === undefined) return null
  const read = await Promise.all(
    chain.files.map(async (file) =>
      readTranscriptFile(file.path, {
        fileName: `${file.sessionId}.jsonl`,
        lines: await readLines(file.path),
        parse: parseCodexTranscriptLine,
      }),
    ),
  )
  return { ...chain, files: read }
}

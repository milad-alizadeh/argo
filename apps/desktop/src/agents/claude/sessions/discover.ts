// Discovering Claude Sessions on this machine. No Project registration is required and none is
// consulted: the CLI writes its transcripts under one root, and the roster is rebuilt from them
// every launch (ADR-0004, ADR-0008).
import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { stitchChains } from './chains'
import { projectRosterRow, type RosterRow } from './roster'
import { readTranscriptFile, type TranscriptFile, withoutBlocks } from './transcript-file'

// How many transcript files one Roster pass reads, most recently written first. Measured on a
// real tree of 1,055 files holding 3.3 GB: streaming 200 of them costs about 1.6 s and 60 about
// 0.5 s. The count is stated on the reply rather than hidden, so a Roster that did not reach
// every file says so instead of reading as the whole machine.
export const ROSTER_FILE_LIMIT = 200

export type Discovery = {
  rows: RosterRow[]
  filesFound: number
  filesRead: number
  // Files the reader could not open at all. A permission or a vanished file is stated, never
  // folded into "no Sessions here".
  filesUnreadable: number
}

async function transcriptPaths(root: string): Promise<{ path: string; name: string }[]> {
  const directories = await readdir(root, { withFileTypes: true })
  const found: { path: string; name: string }[] = []
  for (const directory of directories) {
    if (!directory.isDirectory()) continue
    const inside = await readdir(path.join(root, directory.name)).catch(() => [])
    for (const name of inside) {
      if (name.endsWith('.jsonl')) found.push({ path: path.join(root, directory.name, name), name })
    }
  }
  return found
}

async function writtenAt(file: { path: string }): Promise<number> {
  return (await stat(file.path).catch(() => null))?.mtimeMs ?? 0
}

// Streamed rather than read whole: one transcript on a real tree reaches hundreds of megabytes,
// and holding it as a string to split it would cost that much again.
export async function readLines(filePath: string): Promise<string[]> {
  const lines: string[] = []
  const reader = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity })
  for await (const line of reader) lines.push(line)
  return lines
}

async function readFile(file: { path: string; name: string }): Promise<TranscriptFile | null> {
  try {
    return readTranscriptFile(file.path, file.name, await readLines(file.path))
  } catch {
    return null
  }
}

async function mostRecent(root: string) {
  const found = await transcriptPaths(root)
  const timed = await Promise.all(
    found.map(async (file) => ({ ...file, writtenAt: await writtenAt(file) })),
  )
  timed.sort((left, right) => right.writtenAt - left.writtenAt)
  return { found, recent: timed.slice(0, ROSTER_FILE_LIMIT) }
}

// Summaries already read, keyed by path and stamped with the mtime they were read at. Reading a
// Roster and then opening a Feed are two passes over the same tree, and streaming 200 files costs
// about 1.6 s each time; listing the tree and stamping it costs milliseconds. So the listing is
// redone every pass — a file rewritten since is re-read, and a Session created since is found —
// and only the parsing is kept. Blocks are already dropped, so what is held is the small half.
const summaries = new Map<string, { writtenAt: number; file: TranscriptFile }>()

async function summaryOf(candidate: {
  path: string
  name: string
  writtenAt: number
}): Promise<TranscriptFile | null> {
  const held = summaries.get(candidate.path)
  if (held !== undefined && held.writtenAt === candidate.writtenAt) return held.file
  const read = await readFile(candidate)
  if (read === null) return null
  const file = withoutBlocks(read)
  summaries.set(candidate.path, { writtenAt: candidate.writtenAt, file })
  return file
}

// The pass both readings share: every discovered file, summarised, with its blocks dropped as it
// is read. One Session's Feed is then re-read from this pass's own paths, so a Feed and the
// Roster row above it can never disagree about which files a Session is.
async function summarise(root: string) {
  const { found, recent } = await mostRecent(root)
  const files: TranscriptFile[] = []
  let unreadable = 0
  for (const candidate of recent) {
    const file = await summaryOf(candidate)
    if (file === null) unreadable += 1
    else files.push(file)
  }
  // Nothing outside this pass is worth holding: the next one lists the tree again anyway.
  const reached = new Set(recent.map((candidate) => candidate.path))
  for (const path of summaries.keys()) if (!reached.has(path)) summaries.delete(path)
  return { found, files, unreadable }
}

export async function discoverSessions(root: string): Promise<Discovery> {
  const { found, files, unreadable } = await summarise(root)
  const rows = stitchChains(files).map(projectRosterRow)
  rows.sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))
  return {
    rows,
    filesFound: found.length,
    filesRead: files.length,
    filesUnreadable: unreadable,
  }
}

// A retired id still finds its Session: a surface holding one follows it to the row that took it
// rather than reading the Session as ended (CONTEXT.md L2 · retired id).
export async function readSessionFiles(root: string, sessionId: string) {
  const { files } = await summarise(root)
  const chain = stitchChains(files).find(
    (candidate) => candidate.id === sessionId || candidate.retiredIds.includes(sessionId),
  )
  if (chain === undefined) return null
  const read = await Promise.all(
    chain.files.map((file) => readFile({ path: file.path, name: `${file.sessionId}.jsonl` })),
  )
  return { ...chain, files: read.filter((file) => file !== null) }
}

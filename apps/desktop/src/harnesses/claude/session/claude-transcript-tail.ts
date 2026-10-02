import { open, stat } from 'node:fs/promises'
import type { SessionStoreEntry } from '@anthropic-ai/claude-agent-sdk'

const MEBIBYTE = 1_048_576
// The first tail is 1 MiB; each wider read takes five times as much, until the whole file.
const FIRST_TAIL_BYTES = MEBIBYTE
const TAIL_GROWTH = 5
// What every cached transcript may hold together, counted in the file bytes it was parsed from;
// the parsed lines take several times as much heap.
const TRANSCRIPT_CACHE_BYTES = 64 * MEBIBYTE
// The bytes before the parsed end a growing file must still hold, or it was rewritten.
const END_CHECK_BYTES = 64

const NEWLINE = 0x0a

export function transcriptTailBytes(extent: number): number {
  return FIRST_TAIL_BYTES * TAIL_GROWTH ** extent
}

// The transcript lines the Agent SDK builds a chain from; the same filter its own file read keeps.
function chainEntry(value: unknown): SessionStoreEntry | null {
  if (typeof value !== 'object' || value === null) return null
  const entry = value as Record<string, unknown>
  const kept = ['user', 'assistant', 'progress', 'system', 'attachment'].includes(
    String(entry.type),
  )
  return kept && typeof entry.uuid === 'string' ? (entry as SessionStoreEntry) : null
}

// Each whole line in `bytes`; a line that is not JSON is skipped, as the SDK skips it.
function parseLines(bytes: Buffer): SessionStoreEntry[] {
  const entries: SessionStoreEntry[] = []
  let start = 0
  while (start < bytes.length) {
    let end = bytes.indexOf(NEWLINE, start)
    if (end === -1) end = bytes.length
    const line = bytes.toString('utf8', start, end).trim()
    start = end + 1
    if (line === '') continue
    try {
      const entry = chainEntry(JSON.parse(line))
      if (entry !== null) entries.push(entry)
    } catch {}
  }
  return entries
}

type FileIdentity = { ino: number; size: number; mtimeMs: number }

// One transcript's parsed lines from `start` to `end`, both on line boundaries; `reached` is the
// earliest byte read, inside the cut line before `start`, and `endCheck` the bytes just before `end`.
type CachedTranscript = FileIdentity & {
  reached: number
  start: number
  end: number
  endCheck: Buffer
  entries: SessionStoreEntry[]
}

// The whole lines in `bytes`, read from `wanted` up to `start`, put before the parsed ones; the
// line `wanted` falls inside is left out.
function prependLines(cached: CachedTranscript, wanted: number, bytes: Buffer): CachedTranscript {
  const first = wanted === 0 ? 0 : bytes.indexOf(NEWLINE) + 1
  if (wanted > 0 && first === 0) return { ...cached, reached: wanted }
  const entries = parseLines(bytes.subarray(first))
  const start = wanted + first
  return { ...cached, reached: wanted, start, entries: [...entries, ...cached.entries] }
}

// A copy, so the check does not hold the whole read buffer.
function copyEnd(read: Buffer, end: number): Buffer {
  return Buffer.from(read.subarray(Math.max(0, end - END_CHECK_BYTES), end))
}

export type TranscriptTail = { entries: SessionStoreEntry[]; whole: boolean }

export type ReadRange = (file: string, start: number, end: number) => Promise<Buffer>

async function readFileRange(file: string, start: number, end: number): Promise<Buffer> {
  const handle = await open(file, 'r')
  try {
    const buffer = Buffer.alloc(end - start)
    let offset = 0
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        offset,
        buffer.length - offset,
        start + offset,
      )
      if (bytesRead === 0) break
      offset += bytesRead
    }
    return buffer.subarray(0, offset)
  } finally {
    await handle.close()
  }
}

// Parsed transcript tails, kept between opens and keyed by the file's inode, size and mtime. A file
// that only grew is read from where the last read stopped; anything else is read again.
export class ClaudeTranscriptTails {
  readonly #files = new Map<string, CachedTranscript>()
  readonly #readRange: ReadRange
  readonly #limitBytes: number

  constructor(readRange: ReadRange = readFileRange, limitBytes = TRANSCRIPT_CACHE_BYTES) {
    this.#readRange = readRange
    this.#limitBytes = limitBytes
  }

  // At least the last `bytes` of the file, more when an earlier read already parsed more.
  async read(file: string, bytes: number): Promise<TranscriptTail> {
    const { ino, size, mtimeMs } = await stat(file)
    let cached = this.#files.get(file)
    const grewOnly =
      cached !== undefined &&
      cached.ino === ino &&
      (size > cached.size || (size === cached.size && mtimeMs === cached.mtimeMs))
    if (cached !== undefined && grewOnly && size > cached.size)
      cached = (await this.#readAppended(file, cached, size)) ?? undefined
    if (cached === undefined || !grewOnly) cached = await this.#readFresh(file, size, bytes)
    else {
      const wanted = Math.max(0, size - bytes)
      if (wanted < cached.reached) cached = await this.#readEarlier(file, cached, wanted)
    }
    const current = { ...cached, ino, size, mtimeMs }
    this.#remember(file, current)
    return { entries: current.entries, whole: current.start === 0 }
  }

  // The tail ends at its last whole line, so the reads that follow it start on a line boundary.
  async #readFresh(file: string, size: number, bytes: number): Promise<CachedTranscript> {
    const wanted = Math.max(0, size - bytes)
    const read = await this.#readRange(file, wanted, size)
    const end = wanted + read.lastIndexOf(NEWLINE) + 1
    const endCheck = copyEnd(read, end - wanted)
    const empty = { ino: 0, size: 0, mtimeMs: 0, reached: end, start: end, end, endCheck }
    return prependLines({ ...empty, entries: [] }, wanted, read.subarray(0, end - wanted))
  }

  // Whole lines from `end` up to the file's size; a last line still being written waits. Null when
  // the bytes before `end` changed, so the file was rewritten rather than grown.
  async #readAppended(file: string, cached: CachedTranscript, size: number) {
    const checkFrom = cached.end - cached.endCheck.length
    const read = await this.#readRange(file, checkFrom, size)
    if (!read.subarray(0, cached.endCheck.length).equals(cached.endCheck)) return null
    const bytes = read.subarray(cached.endCheck.length)
    const lastNewline = bytes.lastIndexOf(NEWLINE)
    if (lastNewline === -1) return cached
    const end = cached.end + lastNewline + 1
    return {
      ...cached,
      end,
      endCheck: copyEnd(read, end - checkFrom),
      entries: [...cached.entries, ...parseLines(bytes.subarray(0, lastNewline + 1))],
    }
  }

  async #readEarlier(file: string, cached: CachedTranscript, wanted: number) {
    if (wanted >= cached.reached) return cached
    return prependLines(cached, wanted, await this.#readRange(file, wanted, cached.start))
  }

  // The newest file stays; the files used longest ago leave first once the bytes pass the limit.
  #remember(file: string, transcript: CachedTranscript) {
    this.#files.delete(file)
    this.#files.set(file, transcript)
    let held = 0
    for (const cached of this.#files.values()) held += cached.end - cached.start
    for (const [key, cached] of this.#files) {
      if (held <= this.#limitBytes || key === file) break
      held -= cached.end - cached.start
      this.#files.delete(key)
    }
  }
}

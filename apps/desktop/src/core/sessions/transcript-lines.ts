import { type FileHandle, open } from 'node:fs/promises'

import type { TranscriptParser, TranscriptRecord } from './transcript'

export const ROSTER_FILE_LIMIT = 200

const CHUNK_BYTES = 1024 * 1024
// The bytes just before the parsed end that must still be there for a file to count as appended to.
const SEAM_BYTES = 64
// Two files a chain for each of the six Feeds the reader keeps (KEPT_FEED_LIMIT).
const HELD_FILE_LIMIT = 12
const NEWLINE = 0x0a

type HeldTranscript = { inode: number; end: number; seam: Buffer; records: TranscriptRecord[] }

type Consumed = { end: number; seam: Buffer; unfinished: Buffer }

function withoutReturn(line: string) {
  return line.endsWith('\r') ? line.slice(0, -1) : line
}

async function readLines(
  handle: FileHandle,
  span: { end: number; seam: Buffer; to: number },
  onLine: (line: string) => void,
): Promise<Consumed> {
  const { to } = span
  let { end, seam } = span
  let position = end
  let pending = Buffer.alloc(0)
  while (position < to) {
    const chunk = Buffer.allocUnsafe(Math.min(CHUNK_BYTES, to - position))
    const { bytesRead } = await handle.read(chunk, 0, chunk.length, position)
    if (bytesRead === 0) break
    position += bytesRead
    const bytes = Buffer.concat([pending, chunk.subarray(0, bytesRead)])
    const last = bytes.lastIndexOf(NEWLINE)
    if (last === -1) {
      pending = bytes
      continue
    }
    for (const line of bytes.subarray(0, last).toString('utf8').split('\n')) {
      onLine(withoutReturn(line))
    }
    seam = Buffer.from(bytes.subarray(Math.max(0, last + 1 - SEAM_BYTES), last + 1))
    pending = Buffer.from(bytes.subarray(last + 1))
    end = position - pending.length
  }
  return { end, seam, unfinished: pending }
}

// Where to resume: the held end, if the file is the same one and still holds the bytes before it.
async function resumeFrom(
  handle: FileHandle,
  held: HeldTranscript | undefined,
  file: { ino: number; size: number },
) {
  const start = { end: 0, seam: Buffer.alloc(0), records: [] as TranscriptRecord[] }
  if (held === undefined || held.inode !== file.ino || file.size < held.end) return start
  const seam = Buffer.alloc(held.seam.length)
  await handle.read(seam, 0, seam.length, held.end - seam.length)
  return seam.equals(held.seam) ? { ...held, records: [...held.records] } : start
}

// A last line with no newline is a write still in flight, not yet a record, unless it parses whole.
function finishedTail(parse: TranscriptParser, unfinished: Buffer): TranscriptRecord[] {
  const record = parse(withoutReturn(unfinished.toString('utf8')))
  return record === null || record.kind === 'unreadable' ? [] : [record]
}

function hold(held: Map<string, HeldTranscript>, filePath: string, transcript: HeldTranscript) {
  held.delete(filePath)
  held.set(filePath, transcript)
  while (held.size > HELD_FILE_LIMIT) {
    const oldest = held.keys().next().value
    if (oldest === undefined) return
    held.delete(oldest)
  }
}

// A transcript a CLI is still writing grows by appends, so a held file is read from where the last
// read stopped rather than parsed whole again (#2127). `keep` holds a file not held yet.
export function createTranscriptRecordReader(parse: TranscriptParser) {
  const held = new Map<string, HeldTranscript>()
  return async function readRecords(filePath: string, { keep }: { keep: boolean }) {
    const handle = await open(filePath, 'r')
    try {
      const { ino, size } = await handle.stat()
      const prior = held.get(filePath)
      const start = await resumeFrom(handle, prior, { ino, size })
      const { records } = start
      const consumed = await readLines(handle, { ...start, to: size }, (line) => {
        const record = parse(line)
        if (record !== null) records.push(record)
      })
      if (keep || prior !== undefined) {
        hold(held, filePath, { inode: ino, end: consumed.end, seam: consumed.seam, records })
      }
      const tail = finishedTail(parse, consumed.unfinished)
      return tail.length === 0 ? records : [...records, ...tail]
    } finally {
      await handle.close()
    }
  }
}

import { type FileHandle, open } from 'node:fs/promises'

import type { TranscriptParser, TranscriptRecord } from './transcript'

export const ROSTER_FILE_LIMIT = 200

const CHUNK_BYTES = 1024 * 1024
// The bytes just before the parsed end that must still be there for a file to count as appended to.
const SEAM_BYTES = 64
// Two files a chain for each of the six Feeds the reader keeps (KEPT_FEED_LIMIT).
const HELD_FILE_LIMIT = 12
const NEWLINE = 0x0a

// Where parsing stopped: the byte after the last full line, and the bytes just before it.
type ReadPoint = { end: number; seam: Buffer }

type HeldTranscript = ReadPoint & { inode: number; records: TranscriptRecord[] }

function withoutReturn(line: string) {
  return line.endsWith('\r') ? line.slice(0, -1) : line
}

function seamAfter(seam: Buffer, lines: Buffer) {
  return Buffer.from(Buffer.concat([seam, lines.subarray(-SEAM_BYTES)]).subarray(-SEAM_BYTES))
}

async function readLines(
  handle: FileHandle,
  span: ReadPoint & { to: number },
  onLine: (line: string) => void,
): Promise<ReadPoint & { unfinished: Buffer }> {
  let point: ReadPoint = { end: span.end, seam: span.seam }
  let position = span.end
  let pending: Buffer[] = []
  while (position < span.to) {
    const chunk = Buffer.allocUnsafe(Math.min(CHUNK_BYTES, span.to - position))
    const { bytesRead } = await handle.read(chunk, 0, chunk.length, position)
    if (bytesRead === 0) break
    position += bytesRead
    const read = chunk.subarray(0, bytesRead)
    const last = read.lastIndexOf(NEWLINE)
    if (last === -1) {
      pending.push(read)
      continue
    }
    const lines = Buffer.concat([...pending, read.subarray(0, last + 1)])
    for (const line of lines.subarray(0, -1).toString('utf8').split('\n')) {
      onLine(withoutReturn(line))
    }
    point = { end: point.end + lines.length, seam: seamAfter(point.seam, lines) }
    pending = [Buffer.from(read.subarray(last + 1))]
  }
  return { ...point, unfinished: Buffer.concat(pending) }
}

// Where to resume: the held end, if the file is the same one, no shorter, and still holds the seam.
// An edit further back than the seam, in place and without shrinking the file, goes unseen: the
// CLIs only append.
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
// read stopped rather than parsed whole again (#2127). Every read holds its end point, so a Roster
// pass that reads a file first leaves the Feed's later read of the same file able to resume too
// (#2145) — `HELD_FILE_LIMIT`'s LRU eviction is what bounds the memory this costs.
export function createTranscriptRecordReader(parse: TranscriptParser) {
  const held = new Map<string, HeldTranscript>()
  return async function readRecords(filePath: string) {
    const handle = await open(filePath, 'r')
    try {
      const { ino, size } = await handle.stat()
      const prior = held.get(filePath)
      const start = await resumeFrom(handle, prior, { ino, size })
      const { records } = start
      const { unfinished, ...point } = await readLines(handle, { ...start, to: size }, (line) => {
        const record = parse(line)
        if (record !== null) records.push(record)
      })
      hold(held, filePath, { ...point, inode: ino, records })
      return [...records, ...finishedTail(parse, unfinished)]
    } finally {
      await handle.close()
    }
  }
}

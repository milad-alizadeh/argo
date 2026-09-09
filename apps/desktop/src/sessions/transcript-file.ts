// One transcript file, read into the records this slice draws from. The physical per-file CLI
// record (CONTEXT.md L2 · Transcript file), never itself called a Session.
import { parseTranscriptLine, type TranscriptRecord } from './records'

export type TranscriptFile = {
  path: string
  // The file's own `sessionId`. It is the id this file's rows were published under, and a chain
  // of resumes retires all but the origin's.
  sessionId: string
  // The `leafUuid` the FIRST `last-prompt` record names: the record the file was opened on, so
  // the predecessor it resumed. Later `last-prompt` records track the file's own moving leaf and
  // say nothing about where it came from.
  resumedFrom: string | null
  originSessionId: string | null
  openedAt: string
  // The first line of the first prompt, kept so a Session with no CLI title still has a name
  // after `withoutBlocks` has dropped the prose it came from.
  openingPrompt: string | null
  records: TranscriptRecord[]
  // How many lines the reader could not make a record of. Shown rather than hidden: a Session
  // whose history is short because the file is damaged must not read as a short Session.
  unreadableLines: number
}

function earliestTimestamp(records: TranscriptRecord[]): string {
  const stamps = records.flatMap((record) =>
    record.kind === 'message' && record.timestamp !== null ? [record.timestamp] : [],
  )
  return stamps.length === 0 ? '' : stamps.reduce((first, next) => (next < first ? next : first))
}

function firstOf<Kind extends TranscriptRecord['kind']>(records: TranscriptRecord[], kind: Kind) {
  return records.find(
    (record): record is Extract<TranscriptRecord, { kind: Kind }> => record.kind === kind,
  )
}

function readOpeningPrompt(records: TranscriptRecord[]): string | null {
  for (const record of records) {
    if (record.kind !== 'message' || record.role !== 'user') continue
    for (const block of record.blocks) {
      const line =
        block.shape === 'prose' ? block.text.split('\n').find((text) => text.trim()) : undefined
      if (line !== undefined) return line.trim()
    }
  }
  return null
}

// `sessionId` is read off the file NAME, not off a record: a file whose every line is damaged
// still names a Session, and the CLI names the file for the Session it opened.
export function readTranscriptFile(path: string, fileName: string, lines: Iterable<string>) {
  const records: TranscriptRecord[] = []
  for (const line of lines) {
    const record = parseTranscriptLine(line)
    if (record !== null) records.push(record)
  }
  const message = firstOf(records, 'message')
  const file: TranscriptFile = {
    path,
    sessionId: fileName.replace(/\.jsonl$/, ''),
    resumedFrom: firstOf(records, 'link')?.leafUuid ?? null,
    originSessionId: message?.originSessionId ?? null,
    openedAt: earliestTimestamp(records),
    openingPrompt: readOpeningPrompt(records),
    records,
    unreadableLines: records.filter((record) => record.kind === 'unreadable').length,
  }
  return file
}

// The Roster reads every discovered file; the Feed reads one chain. Content blocks are the whole
// weight of a transcript — a real tree here holds 3.3 GB across 1,055 files — so the Roster pass
// drops them as each file is read and keeps only what a row is projected from. Nothing a Roster
// row states comes from a block.
export function withoutBlocks(file: TranscriptFile): TranscriptFile {
  return {
    ...file,
    records: file.records.map((record) =>
      record.kind === 'message' ? { ...record, blocks: [] } : record,
    ),
  }
}

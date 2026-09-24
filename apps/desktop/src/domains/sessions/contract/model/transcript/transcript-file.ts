import type { TranscriptFile, TranscriptParser, TranscriptRecord } from './transcript'

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

function firstLine(text: string | null | undefined): string | undefined {
  return text
    ?.split('\n')
    .find((line) => line.trim())
    ?.trim()
}

function promptLine(record: TranscriptRecord): string | undefined {
  // A voice thread opens on what the person said, handed over as a voice request rather than a prompt.
  if (record.kind === 'event')
    return record.event === 'command' || record.event === 'skill-invocation'
      ? firstLine(record.text)
      : undefined
  if (record.kind !== 'message' || record.role !== 'user') return undefined
  return record.blocks
    .map((block) =>
      block.shape === 'prose' ||
      block.shape === 'pasted-content' ||
      (block.shape === 'event' && (block.event === 'command' || block.event === 'skill-invocation'))
        ? firstLine(block.text)
        : undefined,
    )
    .find((line) => line !== undefined)
}

function readOpeningPrompt(records: TranscriptRecord[]): string | null {
  for (const record of records) {
    const line = promptLine(record)
    if (line !== undefined) return line
  }
  return null
}

function foldCompactionSummaries(records: TranscriptRecord[]): TranscriptRecord[] {
  const folded: TranscriptRecord[] = []
  for (const record of records) {
    const boundary = folded.at(-1)
    if (record.kind === 'compaction-summary' && boundary?.kind === 'compaction') {
      folded[folded.length - 1] = { ...boundary, summary: record.text }
    } else {
      folded.push(record)
    }
  }
  return folded
}

export function readTranscriptFile(
  path: string,
  {
    sessionId,
    lines,
    parse,
  }: {
    sessionId: string
    lines: Iterable<string>
    parse: TranscriptParser
  },
): TranscriptFile {
  const records: TranscriptRecord[] = []
  for (const line of lines) {
    const record = parse(line)
    if (record === null) continue
    records.push(record)
  }
  return transcriptFileFrom(path, { sessionId, records })
}

export function transcriptFileFrom(
  path: string,
  { sessionId, records }: { sessionId: string; records: TranscriptRecord[] },
): TranscriptFile {
  const foldedRecords = foldCompactionSummaries(records)
  const message = firstOf(foldedRecords, 'message')
  return {
    path,
    sessionId,
    resumedFrom: firstOf(records, 'link')?.leafUuid ?? null,
    originSessionId: message?.originSessionId ?? null,
    openedAt: earliestTimestamp(foldedRecords),
    openingPrompt: readOpeningPrompt(foldedRecords),
    records: foldedRecords,
    unreadableLines: foldedRecords.filter((record) => record.kind === 'unreadable').length,
  }
}

export function withoutBlocks(file: TranscriptFile): TranscriptFile {
  return {
    ...file,
    records: file.records.map((record) =>
      record.kind === 'message' ? { ...record, blocks: [] } : record,
    ),
  }
}

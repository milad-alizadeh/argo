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

function readOpeningPrompt(records: TranscriptRecord[]): string | null {
  for (const record of records) {
    if (record.kind !== 'message' || record.role !== 'user') continue
    for (const block of record.blocks) {
      const line =
        block.shape === 'prose' || (block.shape === 'event' && block.event === 'command')
          ? block.text?.split('\n').find((text) => text.trim())
          : undefined
      if (line !== undefined) return line.trim()
    }
  }
  return null
}

export function readTranscriptFile(
  path: string,
  {
    fileName,
    lines,
    parse,
  }: {
    fileName: string
    lines: Iterable<string>
    parse: TranscriptParser
  },
): TranscriptFile {
  const records: TranscriptRecord[] = []
  for (const line of lines) {
    const record = parse(line)
    if (record === null) continue
    // The CLI writes the compaction summary as the very next record after the boundary it
    // belongs to; fold it there instead of letting it stand as its own record (#2206).
    const boundary = records.at(-1)
    if (record.kind === 'compaction-summary' && boundary?.kind === 'compaction') {
      records[records.length - 1] = { ...boundary, summary: record.text }
      continue
    }
    records.push(record)
  }
  return transcriptFileFrom(path, { fileName, records })
}

export function transcriptFileFrom(
  path: string,
  { fileName, records }: { fileName: string; records: TranscriptRecord[] },
): TranscriptFile {
  const message = firstOf(records, 'message')
  return {
    path,
    sessionId: fileName.replace(/\.jsonl$/, ''),
    resumedFrom: firstOf(records, 'link')?.leafUuid ?? null,
    originSessionId: message?.originSessionId ?? null,
    openedAt: earliestTimestamp(records),
    openingPrompt: readOpeningPrompt(records),
    records,
    unreadableLines: records.filter((record) => record.kind === 'unreadable').length,
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

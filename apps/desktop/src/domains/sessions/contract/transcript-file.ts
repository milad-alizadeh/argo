import type {
  TranscriptFile,
  TranscriptParser,
  TranscriptRecord,
} from '@/domains/sessions/contract/transcript'

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
    return record.event === 'command' ? firstLine(record.text) : undefined
  if (record.kind !== 'message' || record.role !== 'user') return undefined
  return record.blocks
    .map((block) =>
      block.shape === 'prose' || (block.shape === 'event' && block.event === 'command')
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

// The Session id a transcript file's name carries.
export function sessionIdOfFile(fileName: string) {
  return fileName.replace(/\.jsonl$/, '')
}

export function transcriptFileFrom(
  path: string,
  { fileName, records }: { fileName: string; records: TranscriptRecord[] },
): TranscriptFile {
  const message = firstOf(records, 'message')
  return {
    path,
    sessionId: sessionIdOfFile(fileName),
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

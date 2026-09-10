import type { FeedMarker, SessionEntry } from './models'

export type ContentBlock =
  | { shape: 'prose'; text: string }
  // A `thinking` block, which the domain calls a Thought and never a Message (CONTEXT.md L3 ·
  // Thought). The CLI writes most of them with the text withheld, so an empty one is ordinary.
  | { shape: 'thought'; text: string }
  | { shape: 'marker'; marker: FeedMarker }
  // The honest fallback for content this Feed cannot draw richly yet: the block's own `type`
  // verbatim as the label, and its own JSON as the source. Nothing is summarised or dropped.
  | { shape: 'source'; label: string; source: string }

export type ToolCall = { id: string; name: string; input: Record<string, unknown> }

export type TranscriptMessage = {
  kind: 'message'
  uuid: string
  parentUuid: string | null
  originSessionId: string | null
  role: 'user' | 'assistant'
  sidechain: boolean
  cwd: string | null
  branch: string | null
  timestamp: string | null
  entry: SessionEntry
  stopReason: string | null
  blocks: ContentBlock[]
  toolCalls: ToolCall[]
  answeredCalls: string[]
}

export type TranscriptRecord =
  | TranscriptMessage
  | { kind: 'link'; leafUuid: string }
  | { kind: 'title'; title: string; source: 'custom' | 'summarised' }
  | { kind: 'trace'; uuid: string }
  // The CLI's `pr-link` record: a pull request this Session opened or was pointed at.
  | { kind: 'pull-request'; number: number; url: string; repository: string | null }
  // The CLI's `compact_boundary` system record: the point where history was condensed.
  | { kind: 'compaction'; uuid: string }
  | { kind: 'unreadable'; line: string }

export type TranscriptFile = {
  path: string
  sessionId: string
  resumedFrom: string | null
  originSessionId: string | null
  openedAt: string
  openingPrompt: string | null
  records: TranscriptRecord[]
  unreadableLines: number
}

export type TranscriptParser = (line: string) => TranscriptRecord | null

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
    if (record !== null) records.push(record)
  }
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

import type { FeedMarker, SessionEntry } from './models'

export type ContentBlock =
  | { shape: 'prose'; text: string }
  // A `thinking` block, which the domain calls a Thought and never a Message (CONTEXT.md L3 ·
  // Thought). The CLI writes most of them with the text withheld, so an empty one is ordinary.
  | { shape: 'thought'; text: string }
  | { shape: 'marker'; marker: FeedMarker }
  | { shape: 'event'; event: TranscriptEventKind; text: string | null }
  | { shape: 'tool'; callId: string }
  // The honest fallback for content this Feed cannot draw richly yet: the block's own `type`
  // verbatim as the label, and its own JSON as the source. Nothing is summarised or dropped.
  | { shape: 'source'; label: string; source: string }

export type ToolCall = { id: string; name: string; input: Record<string, unknown> }
export type ToolResult = {
  callId: string
  content: string | null
  failed: boolean
  // The receipt a call sent to the background writes instead of a result: the id the CLI will
  // notify under, and the file it streams the command's output to (CONTEXT.md L3 · Tool Call).
  background?: { taskId: string; outputPath: string | null }
}
export type TranscriptUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

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
  // The CLI's own Model, Effort and Mode words, verbatim (CONTEXT.md L2 · Model and Effort).
  model: string | null
  effort: string | null
  mode: string | null
  blocks: ContentBlock[]
  toolCalls: ToolCall[]
  toolResults?: ToolResult[]
  answeredCalls: string[]
  usage: TranscriptUsage | null
}

// The statuses a background task ends on, as the CLI's own notification words them.
export const BACKGROUND_STATES = ['completed', 'failed', 'killed', 'stopped'] as const
export type BackgroundState = (typeof BACKGROUND_STATES)[number]

// A harness delivery that tells the reader something useful without being one of the person's Messages.
export const TRANSCRIPT_EVENT_KINDS = ['status', 'transcript', 'context', 'command'] as const
export type TranscriptEventKind = (typeof TRANSCRIPT_EVENT_KINDS)[number]

export type TranscriptRecord =
  | TranscriptMessage
  | { kind: 'command-output'; uuid: string; timestamp: string | null; text: string }
  | { kind: 'event'; uuid: string; event: TranscriptEventKind; text: string | null }
  | { kind: 'link'; leafUuid: string }
  | { kind: 'title'; title: string; source: 'custom' | 'summarised' }
  // `subagent` is Codex-only: true when the thread was spawned by another agent rather than
  // opened by a person, so discovery can drop the whole file rather than name it by its uuid.
  // `cwd` is Codex-only too: `session_meta` is the only record naming the folder a resume needs,
  // since every codex message record carries none (#2092).
  | { kind: 'trace'; uuid: string; subagent?: boolean; cwd?: string | null }
  // The CLI's `pr-link` record: a pull request this Session opened or was pointed at.
  | { kind: 'pull-request'; number: number; url: string; repository: string | null }
  // The CLI's `compact_boundary` system record: the point where history was condensed.
  | { kind: 'compaction'; uuid: string; timestamp?: string }
  // The CLI's `task-notification`: the end of one background task, naming the call that started
  // it, where its output was written, and how it ended.
  | {
      kind: 'background-task'
      taskId: string
      callId: string
      outputPath: string | null
      state: BackgroundState
      summary: string | null
      timestamp: string | null
    }
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
    if (record !== null) records.push(record)
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

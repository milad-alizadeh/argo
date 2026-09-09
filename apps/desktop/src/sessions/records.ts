// One JSONL line of a Claude transcript, parsed into the shapes this slice reads and nothing
// else. Grounded on the records real transcripts under `~/.claude/projects` carry today: `user`,
// `assistant`, `last-prompt`, `ai-title`, `custom-title`. Every other `type` is bookkeeping this
// slice does not draw, and is skipped rather than guessed at.
import { isRecord } from '../boundary'

export type ContentBlock =
  | { shape: 'prose'; text: string }
  // The honest fallback for content this Feed cannot draw richly yet: the block's own `type`
  // verbatim as the label, and its own JSON as the source. Nothing is summarised or dropped.
  | { shape: 'source'; label: string; source: string }

export type TranscriptMessage = {
  kind: 'message'
  uuid: string
  parentUuid: string | null
  // The snake_case `session_id`, which names the chain's ORIGIN rather than the file's own
  // Session (CONTEXT.md L2 · Transcript file). Absent on most records, which is why it is a
  // fallback for stitching and never the key.
  originSessionId: string | null
  role: 'user' | 'assistant'
  // A record written by a subagent's own turn rather than by this Session's. The CLI nests these;
  // Argo neither draws them as the Session's history nor reads their stop reason as its status,
  // because a subagent finishing is not this Session finishing.
  sidechain: boolean
  cwd: string | null
  branch: string | null
  timestamp: string | null
  entry: SessionEntry
  stopReason: string | null
  blocks: ContentBlock[]
  // The two block facts the status reading needs by name rather than as drawn source: which
  // tools this record called, and which earlier calls it answered.
  toolCalls: { id: string; name: string }[]
  answeredCalls: string[]
}

export type TranscriptRecord =
  | TranscriptMessage
  | { kind: 'link'; leafUuid: string }
  | { kind: 'title'; title: string; source: 'custom' | 'summarised' }
  // A record this slice draws nothing from, kept for its uuid alone. A file names records of
  // types Argo does not read — attachments among them — and a resume can be opened on one of
  // them. Dropping the line entirely loses the only fact that tells a file which opened on its
  // own first record from one that opened on another file's last.
  | { kind: 'trace'; uuid: string }
  // A line that is not JSON, or a message record with no identity. Kept rather than dropped so
  // the Feed can say a record was unreadable instead of quietly shortening the history.
  | { kind: 'unreadable'; line: string }

// CONTEXT.md L2 · Entry, the closed set. Written once and derived from, like every other
// vocabulary this slice reads.
export const SESSION_ENTRIES = ['interactive', 'headless'] as const

export type SessionEntry = (typeof SESSION_ENTRIES)[number]

const HEADLESS_ENTRYPOINTS = ['sdk-cli']

// CONTEXT.md L2 · Entry: the word is matched, never interpreted, and everything else — absent,
// unread, or a word this list has not heard of — reads `interactive`. The error that rule
// prevents is one-way: folding a Session somebody is steering out of sight.
function readEntry(value: unknown): SessionEntry {
  return typeof value === 'string' && HEADLESS_ENTRYPOINTS.includes(value)
    ? 'headless'
    : 'interactive'
}

function readBlock(value: unknown): ContentBlock {
  if (isRecord(value) && value.type === 'text' && typeof value.text === 'string') {
    return { shape: 'prose', text: value.text }
  }
  const label = isRecord(value) && typeof value.type === 'string' ? value.type : 'unfamiliar'
  return { shape: 'source', label, source: JSON.stringify(value, null, 2) ?? String(value) }
}

function readBlocks(content: unknown): ContentBlock[] {
  if (typeof content === 'string') return [{ shape: 'prose', text: content }]
  if (!Array.isArray(content)) return []
  return content.map(readBlock)
}

function readToolCalls(content: unknown) {
  if (!Array.isArray(content)) return []
  return content.flatMap((block: unknown) =>
    isRecord(block) &&
    block.type === 'tool_use' &&
    typeof block.id === 'string' &&
    typeof block.name === 'string'
      ? [{ id: block.id, name: block.name }]
      : [],
  )
}

function readAnsweredCalls(content: unknown) {
  if (!Array.isArray(content)) return []
  return content.flatMap((block: unknown) =>
    isRecord(block) && block.type === 'tool_result' && typeof block.tool_use_id === 'string'
      ? [block.tool_use_id]
      : [],
  )
}

function readMessage(record: Record<string, unknown>, role: 'user' | 'assistant') {
  const message = isRecord(record.message) ? record.message : {}
  // `uuid` is the whole identity gate. A record's own `sessionId` is not required: the file name
  // names the Session, and plenty of real records carry no copy of it. Requiring one would drop a
  // whole history as unreadable over a field nothing reads.
  if (typeof record.uuid !== 'string') return null
  const parsed: TranscriptMessage = {
    toolCalls: readToolCalls(message.content),
    answeredCalls: readAnsweredCalls(message.content),
    kind: 'message',
    uuid: record.uuid,
    parentUuid: typeof record.parentUuid === 'string' ? record.parentUuid : null,
    originSessionId: typeof record.session_id === 'string' ? record.session_id : null,
    role,
    sidechain: record.isSidechain === true,
    cwd: typeof record.cwd === 'string' ? record.cwd : null,
    branch: typeof record.gitBranch === 'string' ? record.gitBranch : null,
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : null,
    entry: readEntry(record.entrypoint),
    stopReason: typeof message.stop_reason === 'string' ? message.stop_reason : null,
    blocks: readBlocks(message.content),
  }
  return parsed
}

// A title Argo reads off a record it does not own (CONTEXT.md L2 · CLI title). `custom` is what
// a person typed; `summarised` is what the CLI's own summariser wrote.
function readTitle(record: Record<string, unknown>): TranscriptRecord | null {
  if (record.type === 'custom-title' && typeof record.customTitle === 'string') {
    return { kind: 'title', title: record.customTitle, source: 'custom' }
  }
  if (record.type === 'ai-title' && typeof record.aiTitle === 'string') {
    return { kind: 'title', title: record.aiTitle, source: 'summarised' }
  }
  return null
}

export function parseTranscriptLine(line: string): TranscriptRecord | null {
  if (line.trim().length === 0) return null
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return { kind: 'unreadable', line }
  }
  if (!isRecord(value)) return { kind: 'unreadable', line }
  if (value.type === 'user' || value.type === 'assistant') {
    return readMessage(value, value.type) ?? { kind: 'unreadable', line }
  }
  if (value.type === 'last-prompt' && typeof value.leafUuid === 'string') {
    return { kind: 'link', leafUuid: value.leafUuid }
  }
  const title = readTitle(value)
  if (title !== null) return title
  return typeof value.uuid === 'string' ? { kind: 'trace', uuid: value.uuid } : null
}

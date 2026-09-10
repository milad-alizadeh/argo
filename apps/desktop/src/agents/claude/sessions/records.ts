// One JSONL line of a Claude transcript, parsed into the shapes this slice reads and nothing
// else. Grounded on the records real transcripts under `~/.claude/projects` carry today: `user`,
// `assistant`, `last-prompt`, `ai-title`, `custom-title`. Every other `type` is bookkeeping this
// slice does not draw, and is skipped rather than guessed at.
import { isRecord } from '@/boundary'
import { SESSION_ENTRIES, type SessionEntry } from '@/core/sessions/models'
import type { ContentBlock, TranscriptMessage, TranscriptRecord } from '@/core/sessions/transcript'

export type { ContentBlock, SessionEntry, TranscriptMessage, TranscriptRecord }
// CONTEXT.md L2 · Entry, the closed set. Written once and derived from, like every other
// vocabulary this slice reads.
export { SESSION_ENTRIES }

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

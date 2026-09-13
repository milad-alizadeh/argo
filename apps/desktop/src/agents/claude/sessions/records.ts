import { isRecord } from '@/boundary'
import { SESSION_ENTRIES, type SessionEntry } from '@/core/sessions/models'
import type {
  ContentBlock,
  ToolCall,
  TranscriptMessage,
  TranscriptRecord,
} from '@/core/sessions/transcript'
import { readBlocks, readToolCalls, readToolResults } from './block-reader'

export type { ContentBlock, SessionEntry, ToolCall, TranscriptMessage, TranscriptRecord }
export { SESSION_ENTRIES }

const HEADLESS_ENTRYPOINTS = ['sdk-cli']

function readEntry(value: unknown): SessionEntry {
  return typeof value === 'string' && HEADLESS_ENTRYPOINTS.includes(value)
    ? 'headless'
    : 'interactive'
}

function readUsage(value: unknown) {
  if (!isRecord(value)) return null
  const terms = [
    value.input_tokens,
    value.output_tokens,
    value.cache_read_input_tokens,
    value.cache_creation_input_tokens,
  ]
  if (!terms.every(Number.isInteger)) return null
  return {
    inputTokens: value.input_tokens as number,
    outputTokens: value.output_tokens as number,
    cacheReadTokens: value.cache_read_input_tokens as number,
    cacheCreationTokens: value.cache_creation_input_tokens as number,
  }
}

function readMessage(record: Record<string, unknown>, role: 'user' | 'assistant') {
  const message = isRecord(record.message) ? record.message : {}
  // `uuid` is the whole identity gate. A record's own `sessionId` is not required: the file name
  // names the Session, and plenty of real records carry no copy of it. Requiring one would drop a
  // whole history as unreadable over a field nothing reads.
  if (typeof record.uuid !== 'string') return null
  const parsed: TranscriptMessage = {
    toolCalls: readToolCalls(message.content),
    toolResults: readToolResults(message.content),
    answeredCalls: readToolResults(message.content).map((result) => result.callId),
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
    usage: readUsage(message.usage),
    blocks: readBlocks(message.content),
  }
  return parsed
}

function readTitle(record: Record<string, unknown>): TranscriptRecord | null {
  if (record.type === 'custom-title' && typeof record.customTitle === 'string') {
    return { kind: 'title', title: record.customTitle, source: 'custom' }
  }
  if (record.type === 'ai-title' && typeof record.aiTitle === 'string') {
    return { kind: 'title', title: record.aiTitle, source: 'summarised' }
  }
  return null
}

function readMark(record: Record<string, unknown>): TranscriptRecord | null {
  if (
    record.type === 'pr-link' &&
    Number.isInteger(record.prNumber) &&
    typeof record.prUrl === 'string'
  ) {
    const repository = typeof record.prRepository === 'string' ? record.prRepository : null
    return {
      kind: 'pull-request',
      number: record.prNumber as number,
      url: record.prUrl,
      repository,
    }
  }
  if (record.subtype === 'compact_boundary' && typeof record.uuid === 'string') {
    return { kind: 'compaction', uuid: record.uuid }
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
  const read = readTitle(value) ?? readMark(value)
  if (read !== null) return read
  return typeof value.uuid === 'string' ? { kind: 'trace', uuid: value.uuid } : null
}

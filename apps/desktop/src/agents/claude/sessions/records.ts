import { readBackgroundTask } from '@/agents/claude/sessions/background-task'
import { readBlocks, readToolCalls, readToolResults } from '@/agents/claude/sessions/block-reader'
import { readCommandEnvelope } from '@/agents/claude/sessions/command-envelope'
import { commandSource } from '@/agents/claude/sessions/command-source'
import { messageEnvelope } from '@/agents/claude/sessions/message-envelope'
import { readPlanChanges } from '@/agents/claude/sessions/plan-changes'
import { promptBlocks } from '@/agents/claude/sessions/prompt-images'
import { queuedPromptRecord } from '@/agents/claude/sessions/queued-prompt'
import { readSkillBody } from '@/agents/claude/sessions/skill-body'
import { readStandaloneRecord } from '@/agents/claude/sessions/standalone-records'
import { SESSION_ENTRIES, type SessionEntry } from '@/domains/sessions/contract/model/models'
import type {
  ContentBlock,
  ToolCall,
  TranscriptMessage,
  TranscriptRecord,
} from '@/domains/sessions/contract/model/transcript'
import { isRecord } from '@/shared/validation'

export type { ContentBlock, SessionEntry, ToolCall, TranscriptMessage, TranscriptRecord }
export { SESSION_ENTRIES }

function readEntry(value: unknown): SessionEntry {
  return value === 'sdk-cli' ? 'headless' : 'interactive'
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

function readContent(role: 'user' | 'assistant', message: Record<string, unknown>) {
  return role === 'user' && typeof message.content === 'string'
    ? commandSource(message.content)
    : message.content
}

function readMessageBlocks(role: 'user' | 'assistant', content: unknown) {
  const blocks = readBlocks(content)
  return role === 'user' ? promptBlocks(blocks) : blocks
}

function readMessage(record: Record<string, unknown>, role: 'user' | 'assistant') {
  const message = isRecord(record.message) ? record.message : {}
  const content = readContent(role, message)
  // `uuid` is the whole identity gate. A record's own `sessionId` is not required: the file name
  // names the Session, and plenty of real records carry no copy of it. Requiring one would drop a
  // whole history as unreadable over a field nothing reads.
  if (typeof record.uuid !== 'string') return null
  const results = readToolResults(content, record.toolUseResult)
  const calls = readToolCalls(content)
  const planChanges = readPlanChanges(content, results, record.toolUseResult)
  const parsed: TranscriptMessage = {
    ...(planChanges.length === 0 ? {} : { planChanges }),
    toolCalls: calls,
    toolResults: results,
    answeredCalls: results.map((result) => result.callId),
    kind: 'message',
    uuid: record.uuid,
    ...messageEnvelope(record),
    role,
    entry: readEntry(record.entrypoint),
    stopReason: typeof message.stop_reason === 'string' ? message.stop_reason : null,
    // `<synthetic>` marks a reply the CLI wrote itself, such as an API error, so no model ran it.
    model:
      typeof message.model === 'string' && message.model !== '<synthetic>' ? message.model : null,
    effort: typeof record.effort === 'string' ? record.effort : null,
    mode: typeof record.permissionMode === 'string' ? record.permissionMode : null,
    usage: readUsage(message.usage),
    blocks: readMessageBlocks(role, content),
  }
  return parsed
}

function readUserMessage(record: Record<string, unknown>): TranscriptRecord | null {
  if (typeof record.uuid !== 'string') return null
  if (record.isMeta === true) return readSkillBody(record) ?? { kind: 'trace', uuid: record.uuid }
  const read = readMessage(record, 'user')
  if (read === null) return null
  return readCommandEnvelope(record, read) ?? read
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
    return typeof record.timestamp === 'string'
      ? { kind: 'compaction', uuid: record.uuid, timestamp: record.timestamp }
      : { kind: 'compaction', uuid: record.uuid }
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
  if (value.type === 'user') {
    return readUserMessage(value) ?? { kind: 'unreadable', line }
  }
  if (value.type === 'assistant') {
    return readMessage(value, 'assistant') ?? { kind: 'unreadable', line }
  }
  if (value.type === 'last-prompt' && typeof value.leafUuid === 'string') {
    return { kind: 'link', leafUuid: value.leafUuid }
  }
  const queued = queuedPromptRecord(value)
  if (queued !== null) return readMessage(queued, 'user') ?? { kind: 'unreadable', line }
  const read =
    readBackgroundTask(value) ?? readTitle(value) ?? readMark(value) ?? readStandaloneRecord(value)
  if (read !== null) return read
  return typeof value.uuid === 'string' ? { kind: 'trace', uuid: value.uuid } : null
}

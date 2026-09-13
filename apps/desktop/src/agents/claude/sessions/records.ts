import { isRecord } from '@/boundary'
import { SESSION_ENTRIES, type SessionEntry } from '@/core/sessions/models'
import type {
  ContentBlock,
  ToolCall,
  ToolResult,
  TranscriptMessage,
  TranscriptRecord,
} from '@/core/sessions/transcript'

export type { ContentBlock, SessionEntry, ToolCall, TranscriptMessage, TranscriptRecord }
export { SESSION_ENTRIES }

function readEntry(value: unknown): SessionEntry {
  return value === 'sdk-cli' ? 'headless' : 'interactive'
}

const INTERRUPTED = /^\[Request interrupted by user( for tool use)?\]$/

function readBlock(value: unknown): ContentBlock {
  if (isRecord(value) && value.type === 'text' && typeof value.text === 'string') {
    return INTERRUPTED.test(value.text)
      ? { shape: 'marker', marker: 'interrupted' }
      : { shape: 'prose', text: value.text }
  }
  if (isRecord(value) && value.type === 'thinking' && typeof value.thinking === 'string') {
    return { shape: 'thought', text: value.thinking }
  }
  const label = isRecord(value) && typeof value.type === 'string' ? value.type : 'unfamiliar'
  return { shape: 'source', label, source: JSON.stringify(value, null, 2) ?? String(value) }
}

function readBlocks(content: unknown): ContentBlock[] {
  if (typeof content === 'string') return [{ shape: 'prose', text: content }]
  if (!Array.isArray(content)) return []
  return content.map(readBlock)
}

function readToolCalls(content: unknown): ToolCall[] {
  if (!Array.isArray(content)) return []
  return content.flatMap((block: unknown) =>
    isRecord(block) &&
    block.type === 'tool_use' &&
    typeof block.id === 'string' &&
    typeof block.name === 'string'
      ? [{ id: block.id, name: block.name, input: isRecord(block.input) ? block.input : {} }]
      : [],
  )
}

function readToolResults(content: unknown): ToolResult[] {
  if (!Array.isArray(content)) return []
  return content.flatMap((block: unknown) =>
    isRecord(block) && block.type === 'tool_result' && typeof block.tool_use_id === 'string'
      ? [
          {
            callId: block.tool_use_id,
            content: typeof block.content === 'string' ? block.content : null,
          },
        ]
      : [],
  )
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
    // `<synthetic>` marks a reply the CLI wrote itself, such as an API error, so no model ran it.
    model:
      typeof message.model === 'string' && message.model !== '<synthetic>' ? message.model : null,
    effort: typeof record.effort === 'string' ? record.effort : null,
    mode: typeof record.permissionMode === 'string' ? record.permissionMode : null,
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

import { isRecord } from '@/boundary'
import type { TranscriptRecord } from '@/core/sessions/transcript'

type Prose = { shape: 'prose'; text: string }

function textBlocks(value: unknown, type: string): Prose[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((block) =>
    isRecord(block) && block.type === type && typeof block.text === 'string'
      ? [{ shape: 'prose' as const, text: block.text }]
      : [],
  )
}

function messageRecord(
  record: Record<string, unknown>,
  message: {
    uuid: string
    role: 'user' | 'assistant'
    originSessionId: string | null
    blocks: Prose[]
  },
): TranscriptRecord {
  return {
    kind: 'message',
    uuid: message.uuid,
    parentUuid: null,
    originSessionId: message.originSessionId,
    role: message.role,
    sidechain: false,
    cwd: null,
    branch: null,
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : null,
    entry: 'interactive',
    stopReason: null,
    model: null,
    effort: null,
    mode: null,
    blocks: message.blocks,
    toolCalls: [],
    toolResults: [],
    answeredCalls: [],
    usage: null,
  }
}

function itemMessage(
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  const item = isRecord(payload.item) ? payload.item : null
  let role: 'user' | 'assistant' | null = null
  if (item?.type === 'UserMessage') role = 'user'
  if (item?.type === 'AgentMessage') role = 'assistant'
  if (item === null || role === null || typeof item.id !== 'string') return null
  return messageRecord(record, {
    uuid: item.id,
    role,
    originSessionId: typeof payload.thread_id === 'string' ? payload.thread_id : null,
    blocks: textBlocks(item.content, 'text'),
  })
}

// codex-cli 0.147.0 writes the prompt as a bare string with no id, so the moment it was written
// names it; a record without one is not invented a name.
function promptMessage(
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  if (typeof payload.message !== 'string' || typeof record.timestamp !== 'string') return null
  return messageRecord(record, {
    uuid: `user:${record.timestamp}`,
    role: 'user',
    originSessionId: null,
    blocks: [{ shape: 'prose', text: payload.message }],
  })
}

function event(record: Record<string, unknown>, payload: Record<string, unknown>) {
  if (payload.type !== 'user_message' && payload.type !== 'agent_message') return null
  if (isRecord(payload.item)) return itemMessage(record, payload)
  // The bare `agent_message` event repeats the assistant `response_item`, which carries the id.
  return payload.type === 'user_message' ? promptMessage(record, payload) : null
}

// The assistant message keeps the id its `item/agentMessage/delta` notifications streamed under.
// Codex also writes injected context as user and developer messages here, so only the assistant's
// own are read; the person's prompt is the `user_message` event.
function responseMessage(
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  if (payload.type !== 'message' || payload.role !== 'assistant') return null
  if (typeof payload.id !== 'string') return null
  return messageRecord(record, {
    uuid: payload.id,
    role: 'assistant',
    originSessionId: null,
    blocks: textBlocks(payload.content, 'output_text'),
  })
}

export function parseCodexTranscriptLine(line: string): TranscriptRecord | null {
  if (line.trim().length === 0) return null
  let record: unknown
  try {
    record = JSON.parse(line)
  } catch {
    return { kind: 'unreadable', line }
  }
  if (!isRecord(record)) return { kind: 'unreadable', line }
  const payload = isRecord(record.payload) ? record.payload : null
  if (payload === null) return null
  if (record.type === 'event_msg') return event(record, payload)
  if (record.type === 'response_item') return responseMessage(record, payload)
  if (record.type === 'session_meta' && typeof payload.id === 'string') {
    return { kind: 'trace', uuid: payload.id }
  }
  return null
}

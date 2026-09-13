import { isRecord } from '@/boundary'
import type { TranscriptRecord } from '@/core/sessions/transcript'

function textBlocks(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((block) =>
    isRecord(block) && block.type === 'text' && typeof block.text === 'string'
      ? [{ shape: 'prose' as const, text: block.text }]
      : [],
  )
}

function message(
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  if (payload.type !== 'user_message' && payload.type !== 'agent_message') return null
  const item = isRecord(payload.item) ? payload.item : null
  let role: 'user' | 'assistant' | null = null
  if (item?.type === 'UserMessage') role = 'user'
  if (item?.type === 'AgentMessage') role = 'assistant'
  if (item === null || role === null || typeof item.id !== 'string') return null
  return {
    kind: 'message',
    uuid: item.id,
    parentUuid: null,
    originSessionId: typeof payload.thread_id === 'string' ? payload.thread_id : null,
    role,
    sidechain: false,
    cwd: null,
    branch: null,
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : null,
    entry: 'interactive',
    stopReason: null,
    blocks: textBlocks(item.content),
    toolCalls: [],
    answeredCalls: [],
    usage: null,
  }
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
  if (record.type === 'event_msg' && payload !== null) return message(record, payload)
  if (record.type === 'session_meta' && payload !== null && typeof payload.id === 'string') {
    return { kind: 'trace', uuid: payload.id }
  }
  return null
}

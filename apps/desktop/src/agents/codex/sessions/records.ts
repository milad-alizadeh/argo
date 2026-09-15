import { isRecord } from '@/boundary'
import type { ContentBlock, TranscriptRecord } from '@/core/sessions/transcript'
import { currentUserBlocks } from './current-user-blocks'
import { readHarnessEnvelopes } from './harness-envelopes'
import { MODEL_INPUT_PREFIX } from './model-input-copies'
import { readPlanCall } from './plan-changes'
import { promptBlocks, promptEventImages, readImage } from './prompt-images'

function messageBlocks(value: unknown, proseTypes: readonly string[]): ContentBlock[] | null {
  if (!Array.isArray(value)) return null
  return value.map((block): ContentBlock => {
    const image = isRecord(block) ? readImage(block) : null
    if (image !== null) return image
    if (
      isRecord(block) &&
      typeof block.type === 'string' &&
      proseTypes.includes(block.type) &&
      typeof block.text === 'string'
    ) {
      return { shape: 'prose', text: block.text }
    }
    const label = isRecord(block) && typeof block.type === 'string' ? block.type : 'unfamiliar'
    return { shape: 'source', label, source: JSON.stringify(block, null, 2) ?? String(block) }
  })
}

function messageRecord(
  record: Record<string, unknown>,
  message: {
    uuid: string
    role: 'user' | 'assistant'
    originSessionId: string | null
    blocks: ContentBlock[]
  },
): TranscriptRecord {
  return readHarnessEnvelopes({
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
  })
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
  const blocks = messageBlocks(item.content, ['text', 'Text'])
  if (blocks === null || !Array.isArray(item.content)) return null
  return messageRecord(record, {
    uuid: item.id,
    role,
    originSessionId: typeof payload.thread_id === 'string' ? payload.thread_id : null,
    blocks: role === 'user' ? promptBlocks(item.content, blocks) : blocks,
  })
}

// codex-cli 0.147.0 writes the prompt as a bare string with no id, so the moment it was written
// names it; a record without one is not invented a name.
function promptMessage(
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  if (typeof payload.message !== 'string' || typeof record.timestamp !== 'string') return null
  const images = promptEventImages(payload)
  const content = [{ text_elements: payload.text_elements }, ...images]
  return messageRecord(record, {
    uuid: `user:${record.timestamp}`,
    role: 'user',
    originSessionId: null,
    blocks: promptBlocks(content, [{ shape: 'prose', text: payload.message }, ...images]),
  })
}

function event(record: Record<string, unknown>, payload: Record<string, unknown>) {
  if (payload.type === 'item_completed') return itemMessage(record, payload)
  if (payload.type !== 'user_message' && payload.type !== 'agent_message') return null
  if (isRecord(payload.item)) return itemMessage(record, payload)
  // The bare `agent_message` event repeats the assistant `response_item`, which carries the id.
  return payload.type === 'user_message' ? promptMessage(record, payload) : null
}

// The assistant message keeps the id its `item/agentMessage/delta` notifications streamed under.
// Codex also writes injected context as user and developer messages here; `currentUserBlocks`
// tells the person's own words from the harness's, so both roles are read rather than dropped.
function responseMessage(
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  if (payload.type !== 'message') return readPlanCall(payload)
  if (typeof payload.id !== 'string') return null
  if (payload.role === 'assistant') {
    const blocks = messageBlocks(payload.content, ['output_text'])
    if (blocks === null) return null
    return messageRecord(record, {
      uuid: payload.id,
      role: 'assistant',
      originSessionId: null,
      blocks,
    })
  }
  if (payload.role !== 'user' && payload.role !== 'developer') return null
  const blocks = currentUserBlocks(payload.content, payload.role)
  if (blocks === null || blocks.length === 0) return null
  const uuid = `${MODEL_INPUT_PREFIX}${payload.id}`
  return messageRecord(record, { uuid, role: 'user', originSessionId: null, blocks })
}

// A thread Codex dispatched itself, such as a spawned subagent or the `guardian` reviewer that judges
// an approval (`SessionSource.subagent`, app-server schema): never a person's Session.
function isSubagentThread(meta: Record<string, unknown>): boolean {
  return meta.thread_source === 'subagent' || (isRecord(meta.source) && 'subagent' in meta.source)
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
  // Written once the context is replaced, by a manual `/compact` and an automatic one alike.
  if (record.type === 'compacted' && typeof record.timestamp === 'string')
    return {
      kind: 'compaction',
      uuid: `compacted:${record.timestamp}`,
      timestamp: record.timestamp,
    }
  if (record.type === 'session_meta' && typeof payload.id === 'string') {
    return {
      kind: 'trace',
      uuid: payload.id,
      subagent: isSubagentThread(payload),
      cwd: typeof payload.cwd === 'string' ? payload.cwd : null,
    }
  }
  return null
}

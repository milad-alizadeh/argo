import type { TranscriptRecord } from '@/domains/sessions/contract/model'
import { isRecord } from '@/shared/validation'
import { taskStartedContextWindow } from './context-window'
import { currentUserBlocks } from './current-user-blocks'
import { delegatedRequest } from './harness-envelopes'
import { messageBlocks, messageRecord } from './message-record'
import { MODEL_INPUT_PREFIX } from './model-input-copies'
import { readPlanCall } from './plan-changes'
import { promptBlocks, promptEventImages } from './prompt-images'
import { reasoningSummary } from './reasoning-summary'
import { readSessionFact, readTurnRecord } from './session-facts'
import { subagentActivity } from './subagent-activity'
import { commandPlace, gitBranch } from './thread-place'
import { readToolRecord } from './tool-calls'

// Read off the `item_completed` copy alone; the `response_item` copy repeats it under the same id.
function delegatedPrompt(
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
  item: Record<string, unknown>,
): TranscriptRecord | null {
  if (item.name !== 'create_thread' || typeof item.output !== 'string') return null
  if (typeof item.id !== 'string') return null
  const request = delegatedRequest(item.output)
  if (request === null) return null
  return messageRecord(record, {
    uuid: item.id,
    role: 'user',
    originSessionId: typeof payload.thread_id === 'string' ? payload.thread_id : null,
    blocks: [{ shape: 'prose', text: request }],
  })
}

function itemMessage(
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  const item = isRecord(payload.item) ? payload.item : null
  if (item?.type === 'SubAgentActivity') return subagentActivity(record, item)
  if (item?.type === 'FunctionCallOutput') return delegatedPrompt(record, payload, item)
  if (item?.type === 'CommandExecution') return commandPlace(item)
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

// codex-harness 0.147.0 writes the prompt as a bare string with no id, so the moment it was written
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
  const contextWindow = taskStartedContextWindow(payload)
  if (contextWindow !== null) return contextWindow
  const turn = readTurnRecord(record, payload)
  if (turn !== null) return turn
  // Codex 0.147.0 writes a Subagent activity as its own snake-case event.
  if (payload.type === 'sub_agent_activity')
    return subagentActivity(record, { ...payload, type: 'SubAgentActivity', id: payload.event_id })
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
  if (payload.type !== 'message')
    return (
      reasoningSummary(record, payload) ?? readPlanCall(payload) ?? readToolRecord(record, payload)
    )
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

function subagentDetails(meta: Record<string, unknown>) {
  const source = isRecord(meta.source) ? meta.source : null
  const subagent = source !== null && isRecord(source.subagent) ? source.subagent : null
  const spawn = subagent !== null && isRecord(subagent.thread_spawn) ? subagent.thread_spawn : null
  if (spawn === null) return {}
  return {
    parentSessionId: typeof spawn.parent_thread_id === 'string' ? spawn.parent_thread_id : null,
    agentPath: typeof spawn.agent_path === 'string' ? spawn.agent_path : null,
    agentNickname: typeof spawn.agent_nickname === 'string' ? spawn.agent_nickname : null,
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
  if (payload === null) return null
  if (record.type === 'event_msg') return event(record, payload)
  if (record.type === 'response_item') return responseMessage(record, payload)
  const fact = readSessionFact(record.type, payload)
  if (fact !== null) return fact
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
      ...subagentDetails(payload),
      cwd: typeof payload.cwd === 'string' ? payload.cwd : null,
      branch: gitBranch(payload),
    }
  }
  return null
}

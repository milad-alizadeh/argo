// The rollout's `response_item` lines carry a model's tool use as four record types:
// `function_call`/`custom_tool_call` (the call) and `function_call_output`/
// `custom_tool_call_output` (its result), linked by a shared `call_id`. This reads both pairs
// onto the shared ToolCall/ToolResult shapes (CONTEXT.md L3 · Tool Call) the Claude adapter
// already produces, so `toolPresentation()` and `tool-groups.ts` draw them with no change.

import { isRecord } from '@/shared/validation'
import type { ToolCall, TranscriptRecord } from '../../../domains/sessions/contract/transcript'
import { messageRecord } from './message-record'
import { nestedToolCalls } from './nested-tool-call'
import { readToolResults } from './rich-results'

// `function_call`'s arguments are a JSON object serialised as a string; a `custom_tool_call`'s
// `input` is the bare string the model wrote (a script), so it is kept as a single field rather
// than parsed, matching how `toolPresentation()`'s fallback reads a one-field input.
function readArguments(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed : { arguments: parsed }
  } catch {
    return { arguments: value }
  }
}

function readToolCalls(payload: Record<string, unknown>): ToolCall[] {
  if (typeof payload.call_id !== 'string' || typeof payload.name !== 'string') return []
  if (payload.type === 'function_call')
    return [{ id: payload.call_id, name: payload.name, input: readArguments(payload.arguments) }]
  if (payload.type !== 'custom_tool_call' || typeof payload.input !== 'string') return []
  if (payload.name !== 'exec')
    return [{ id: `${payload.call_id}:0`, name: payload.name, input: { input: payload.input } }]
  const nested = nestedToolCalls(payload.input)
  return nested.length === 0
    ? [{ id: `${payload.call_id}:0`, name: payload.name, input: { input: payload.input } }]
    : nested.map(({ name, argumentsText }, index) => ({
        id: `${payload.call_id}:${index}`,
        name,
        input: readArguments(argumentsText),
      }))
}

const COLLABORATION_CALLS = new Set(['spawn_agent', 'wait_agent'])

// The call becomes the row itself (an assistant delivery); its result carries no block of its
// own, matching how a Claude `tool_result` lands in a message with nothing left to draw.
export function readToolRecord(
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  if (payload.type === 'function_call' || payload.type === 'custom_tool_call') {
    const calls = readToolCalls(payload)
    if (calls.length === 0 || typeof payload.id !== 'string') return null
    if (calls.every((call) => COLLABORATION_CALLS.has(call.name)))
      return { kind: 'trace', uuid: payload.id, boundary: true }
    const visible = calls.filter((call) => !COLLABORATION_CALLS.has(call.name))
    return messageRecord(record, {
      uuid: payload.id,
      role: 'assistant',
      originSessionId: null,
      blocks: visible.map((call) => ({ shape: 'tool' as const, callId: call.id })),
      toolCalls: visible,
    })
  }
  if (payload.type === 'function_call_output' || payload.type === 'custom_tool_call_output') {
    const results = readToolResults(payload)
    if (results.length === 0 || typeof payload.id !== 'string') return null
    return messageRecord(record, {
      uuid: payload.id,
      role: 'user',
      originSessionId: null,
      blocks: [],
      toolResults: results,
    })
  }
  return null
}

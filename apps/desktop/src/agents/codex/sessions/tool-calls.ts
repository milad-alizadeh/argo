// The rollout's `response_item` lines carry a model's tool use as four record types:
// `function_call`/`custom_tool_call` (the call) and `function_call_output`/
// `custom_tool_call_output` (its result), linked by a shared `call_id`. This reads both pairs
// onto the shared ToolCall/ToolResult shapes (CONTEXT.md L3 · Tool Call) the Claude adapter
// already produces, so `toolPresentation()` and `tool-groups.ts` draw them with no change.
import { isRecord } from '@/boundary'
import type { ToolCall, TranscriptRecord } from '@/core/sessions/transcript'
import { messageRecord } from './message-record'

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

function readToolCall(payload: Record<string, unknown>): ToolCall | null {
  if (typeof payload.call_id !== 'string' || typeof payload.name !== 'string') return null
  if (payload.type === 'function_call')
    return { id: payload.call_id, name: payload.name, input: readArguments(payload.arguments) }
  if (payload.type === 'custom_tool_call' && typeof payload.input === 'string')
    return { id: payload.call_id, name: payload.name, input: { input: payload.input } }
  return null
}

// The Responses API's output shape: a bare string, or a list of typed blocks. Only their text
// is read; an image or another output type has nothing this row could show.
function outputText(output: unknown): string | null {
  if (typeof output === 'string') return output
  if (!Array.isArray(output)) return null
  const texts = output.flatMap((block) =>
    isRecord(block) && typeof block.text === 'string' ? [block.text] : [],
  )
  return texts.length === 0 ? null : texts.join('\n')
}

// Neither output record carries a structured pass/fail field. `exec_command`'s own wrapper
// writes its exit code as a free-text line ("Process exited with code N"), which is the only
// grep-able pass/fail signal Codex's rollout carries; anything else (a `custom_tool_call`'s
// script, for instance) has no such convention and reads as succeeded.
const EXIT_CODE = /^Process exited with code (\d+)$/m

function failed(content: string | null): boolean {
  if (content === null) return false
  const match = content.match(EXIT_CODE)
  return match !== null && match[1] !== '0'
}

function readToolResult(payload: Record<string, unknown>) {
  if (typeof payload.call_id !== 'string') return null
  const content = outputText(payload.output)
  return { callId: payload.call_id, content, failed: failed(content) }
}

// The call becomes the row itself (an assistant delivery); its result carries no block of its
// own, matching how a Claude `tool_result` lands in a message with nothing left to draw.
export function readToolRecord(
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  if (payload.type === 'function_call' || payload.type === 'custom_tool_call') {
    const call = readToolCall(payload)
    if (call === null || typeof payload.id !== 'string') return null
    return messageRecord(record, {
      uuid: payload.id,
      role: 'assistant',
      originSessionId: null,
      blocks: [{ shape: 'tool', callId: call.id }],
      toolCalls: [call],
    })
  }
  if (payload.type === 'function_call_output' || payload.type === 'custom_tool_call_output') {
    const result = readToolResult(payload)
    if (result === null || typeof payload.id !== 'string') return null
    return messageRecord(record, {
      uuid: payload.id,
      role: 'user',
      originSessionId: null,
      blocks: [],
      toolResults: [result],
    })
  }
  return null
}

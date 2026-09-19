// The rollout's `response_item` lines carry a model's tool use as four record types:
// `function_call`/`custom_tool_call` (the call) and `function_call_output`/
// `custom_tool_call_output` (its result), linked by a shared `call_id`. This reads both pairs
// onto the shared ToolCall/ToolResult shapes (CONTEXT.md L3 · Tool Call) the Claude adapter
// already produces, so `toolPresentation()` and `tool-groups.ts` draw them with no change.

import { withCommandFacts } from '@/agents/codex/sessions/command-facts'
import { withEditFacts } from '@/agents/codex/sessions/edit-facts'
import { withLookupFacts } from '@/agents/codex/sessions/lookup-facts'
import { messageRecord } from '@/agents/codex/sessions/message-record'
import { nestedToolCalls } from '@/agents/codex/sessions/nested-tool-call'
import { readToolResults } from '@/agents/codex/sessions/rich-results'
import type { ToolCall, TranscriptRecord } from '@/domains/sessions/contract/transcript'
import { isRecord } from '@/shared/validation'
import { withOtherFacts } from './other-facts'

// `function_call`'s arguments are a JSON object serialised as a string; a `custom_tool_call`'s
// `input` is the bare string the model wrote (a script), so it is kept as a single field rather
// than parsed, matching how `toolPresentation()`'s fallback reads a one-field input.
// A script often writes its arguments as JavaScript, not JSON (`"workdir":wd`, `cmd:\`…\``); the
// command, or a web search's first query (`q:"…"`) or opened page (`ref_id:"https://…"`), is
// still one quoted string, and it is the one the Feed labels the call by.
const QUOTED = String.raw`"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|\x60((?:[^\x60\\]|\\.)*)\x60`
const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r' }

function unescaped(literal: string) {
  return literal.replace(/\\(.)/g, (_, character: string) => ESCAPES[character] ?? character)
}

function quotedAfter(value: string, lead: string): string | null {
  const match = value.match(new RegExp(String.raw`${lead}\s*(?:${QUOTED})`))
  const found = match?.[1] ?? match?.[2] ?? match?.[3] ?? null
  return found === null ? null : unescaped(found)
}

function writtenField(value: string, key: string): string | null {
  return quotedAfter(value, String.raw`["']?${key}["']?\s*:`)
}

// `tools.apply_patch(patch)` names a constant the script declared above it, or quotes the patch.
function patchArgument(script: string, argumentsText: string): string | null {
  const identifier = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(argumentsText)?.[1]
  if (identifier !== undefined)
    return quotedAfter(script, String.raw`(?:const|let|var)\s+${identifier}\s*=`)
  return quotedAfter(argumentsText, '^\\s*')
}

function readArguments(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed : { arguments: parsed }
  } catch {
    const cmd = writtenField(value, 'cmd')
    const query = writtenField(value, 'q')
    const url = [writtenField(value, 'ref_id'), writtenField(value, 'url')].find(
      (found) => found?.startsWith('http') === true,
    )
    const path = writtenField(value, 'path')
    return {
      arguments: value,
      ...(cmd === null ? {} : { cmd }),
      ...(path === null ? {} : { path }),
      ...(query === null ? {} : { query }),
      ...(url === undefined ? {} : { url }),
    }
  }
}

function readToolCalls(payload: Record<string, unknown>): ToolCall[] {
  if (typeof payload.call_id !== 'string' || typeof payload.name !== 'string') return []
  if (COMMAND_POLLS.has(payload.name)) return []
  if (payload.type === 'function_call')
    return [{ id: payload.call_id, name: payload.name, input: readArguments(payload.arguments) }]
  if (payload.type !== 'custom_tool_call' || typeof payload.input !== 'string') return []
  if (payload.name !== 'exec')
    return [{ id: `${payload.call_id}:0`, name: payload.name, input: { input: payload.input } }]
  const nested = nestedToolCalls(payload.input)
  return nested.length === 0
    ? [{ id: `${payload.call_id}:0`, name: payload.name, input: { input: payload.input } }]
    : nested
        .map(({ name, argumentsText }, index) => ({
          id: `${payload.call_id}:${index}`,
          name,
          input:
            name === 'apply_patch'
              ? { patch: patchArgument(payload.input as string, argumentsText) ?? argumentsText }
              : readArguments(argumentsText),
        }))
        .filter((call) => !COMMAND_POLLS.has(call.name))
}

// `write_stdin`, `wait` and `sleep` poll a command `exec_command` already drew; Codex shows none.
const COMMAND_POLLS = new Set(['write_stdin', 'wait', 'sleep'])

// Codex draws each of these as the Agent's own activity (`SubAgentActivity`), never as a tool row.
const COLLABORATION_CALLS = new Set([
  'spawn_agent',
  'wait_agent',
  'send_message',
  'followup_task',
  'list_agents',
  'interrupt_agent',
])

// A `web_search_call` item is the call and its outcome in one line, so it lands with its own
// result. `web.search` and `web__run` are the same act written as a function call.
function readWebSearchRecord(
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  if (typeof payload.id !== 'string') return null
  const call = withLookupFacts({
    id: payload.id,
    name: 'web_search_call',
    input: isRecord(payload.action) ? payload.action : {},
  })
  return messageRecord(record, {
    uuid: payload.id,
    role: 'assistant',
    originSessionId: null,
    blocks: [{ shape: 'tool', callId: call.id }],
    toolCalls: [call],
    toolResults: [{ callId: call.id, blocks: [], failed: payload.status === 'failed' }],
  })
}

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
    const visible = calls
      .filter((call) => !COLLABORATION_CALLS.has(call.name))
      .map(withCommandFacts)
      .map(withLookupFacts)
      .map(withEditFacts)
      .map(withOtherFacts)
    return messageRecord(record, {
      uuid: payload.id,
      role: 'assistant',
      originSessionId: null,
      blocks: visible.map((call) => ({ shape: 'tool' as const, callId: call.id })),
      toolCalls: visible,
    })
  }
  if (payload.type === 'web_search_call') return readWebSearchRecord(record, payload)
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

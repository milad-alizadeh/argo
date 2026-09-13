import assert from 'node:assert/strict'

// The subset of `codex app-server`'s JSON-RPC protocol this adapter drives, grounded in codex-cli
// 0.147.0's generated schema (`codex app-server generate-json-schema`) and the live proof recorded
// in docs/research/2026-09-09-codex-transport.md.
export type RequestID = string | number
export type TextInput = { type: 'text'; text: string; text_elements: [] }
export type Input = TextInput | { type: 'localImage'; path: string }
export type ThreadConfiguration = { cwd: string }
export type RequestParams = {
  initialize: {
    clientInfo: { name: string; title: string; version: string }
    capabilities: { experimentalApi: boolean; requestAttestation: boolean }
  }
  'thread/start': ThreadConfiguration
  'thread/resume': ThreadConfiguration & { threadId: string }
  'turn/start': { threadId: string; input: Input[] }
  'turn/interrupt': { threadId: string; turnId: string }
}
export type WireMessage =
  | { method: string; params: Record<string, unknown>; id?: RequestID }
  | { id: RequestID; result: unknown }
  | { id: RequestID; error: { code: number; message: string } }
export type TurnStatus = 'completed' | 'interrupted' | 'failed' | 'inProgress'
export type Turn = { id: string; status: TurnStatus; error: unknown }

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function record(value: unknown, label: string): Record<string, unknown> {
  assert(object(value), `${label} must be an object`)
  return value
}

function string(value: unknown, label: string): string {
  assert(typeof value === 'string', `${label} must be a string`)
  return value
}

export function readMessage(line: string): WireMessage {
  const parsed: unknown = JSON.parse(line)
  const message = record(parsed, 'Protocol envelope')
  let id: RequestID | undefined
  if (Object.hasOwn(message, 'id')) {
    assert(
      typeof message.id === 'string' || typeof message.id === 'number',
      'Invalid protocol request ID',
    )
    id = message.id
  }
  if (Object.hasOwn(message, 'method')) {
    const method = string(message.method, 'Protocol method')
    assert(method.length > 0, 'Invalid protocol method')
    const params = record(message.params, 'Protocol notification/request params')
    assert(
      !Object.hasOwn(message, 'result') && !Object.hasOwn(message, 'error'),
      'Mixed protocol envelope',
    )
    return { ...message, method, params, id }
  }
  assert(id !== undefined, 'Protocol response is missing its ID')
  const hasResult = Object.hasOwn(message, 'result')
  assert(
    hasResult !== Object.hasOwn(message, 'error'),
    'Response needs exactly one result or error',
  )
  if (hasResult) return { ...message, id, result: message.result }
  const error = record(message.error, 'Protocol error')
  assert(
    typeof error.code === 'number' && Number.isInteger(error.code),
    'Protocol error is missing its numeric code',
  )
  return {
    ...message,
    id,
    error: { ...error, code: error.code, message: string(error.message, 'Protocol error message') },
  }
}

export function readThreadId(value: unknown): string {
  const thread = record(record(value, 'Thread result').thread, 'Thread')
  return string(thread.id, 'Thread ID')
}

function readTurn(value: unknown): Turn {
  const turn = record(value, 'Turn')
  const status = turn.status
  assert(
    status === 'completed' ||
      status === 'interrupted' ||
      status === 'failed' ||
      status === 'inProgress',
    'Invalid Turn status',
  )
  return { id: string(turn.id, 'Turn ID'), status, error: turn.error }
}

export function readStartedTurn(value: unknown): Turn {
  return readTurn(record(value, 'Turn start result').turn)
}

export function readCompletedTurn(message: WireMessage) {
  if (!('method' in message) || message.method !== 'turn/completed') return undefined
  return {
    threadId: string(message.params.threadId, 'Completed Turn thread ID'),
    turn: readTurn(message.params.turn),
  }
}

export type AgentMessageText = { threadId: string; itemId: string; text: string }

// A piece of the agent message a Turn is still writing, in order, under the item's id.
export function readAgentMessageDelta(message: WireMessage): AgentMessageText | undefined {
  if (!('method' in message) || message.method !== 'item/agentMessage/delta') return undefined
  return {
    threadId: string(message.params.threadId, 'Delta thread ID'),
    itemId: string(message.params.itemId, 'Delta item ID'),
    text: string(message.params.delta, 'Delta text'),
  }
}

// The whole text of an agent message once Codex finishes it. Other item types are not messages.
export function readCompletedAgentMessage(message: WireMessage): AgentMessageText | undefined {
  if (!('method' in message) || message.method !== 'item/completed') return undefined
  const item = record(message.params.item, 'Completed item')
  if (item.type !== 'agentMessage') return undefined
  return {
    threadId: string(message.params.threadId, 'Completed item thread ID'),
    itemId: string(item.id, 'Completed item ID'),
    text: string(item.text, 'Completed agent message text'),
  }
}

export function readInterrupt(value: unknown): void {
  const result = record(value, 'Interrupt result')
  assert.equal(Object.keys(result).length, 0, 'Interrupt response must be empty')
}

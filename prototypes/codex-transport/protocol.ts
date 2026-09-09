import assert from 'node:assert/strict'

// The subset exercised by this proof, grounded in Codex 0.147.0's generated protocol.
export type RequestID = string | number
export type TextInput = { type: 'text'; text: string; text_elements: [] }
export type Input = TextInput | { type: 'localImage'; path: string }
export type ThreadConfiguration = {
  model: string
  cwd: string
  sandbox: 'read-only'
  approvalPolicy: 'untrusted'
  baseInstructions: string
}
export type RequestParams = {
  initialize: {
    clientInfo: { name: string; title: string; version: string }
    capabilities: { experimentalApi: boolean; requestAttestation: boolean }
  }
  'thread/start': ThreadConfiguration
  'thread/resume': ThreadConfiguration & { threadId: string }
  'thread/read': { threadId: string; includeTurns: true }
  'turn/start': { threadId: string; input: Input[] }
  'turn/interrupt': { threadId: string; turnId: string }
}
export type WireMessage =
  | { method: string; params: Record<string, unknown>; id?: RequestID }
  | { id: RequestID; result: unknown }
  | { id: RequestID; error: { code: number; message: string } }
export type TurnStatus = 'completed' | 'interrupted' | 'failed' | 'inProgress'
type ObservedInput =
  | { type: 'text'; text: string }
  | { type: 'localImage'; path: string }
  | { type: 'image'; url: string }
type Item =
  | { type: 'userMessage'; content: ObservedInput[] }
  | { type: 'agentMessage'; text: string }
export type Turn = { id: string; status: TurnStatus; error: unknown }
export type HistoryTurn = Turn & { items: Item[] }

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

function array(value: unknown, label: string): unknown[] {
  assert(Array.isArray(value), `${label} must be an array`)
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

export function readInitialize(value: unknown) {
  const result = record(value, 'Initialize result')
  return {
    ...result,
    userAgent: string(result.userAgent, 'User agent'),
    codexHome: string(result.codexHome, 'Codex home'),
    platformFamily: string(result.platformFamily, 'Platform family'),
    platformOs: string(result.platformOs, 'Platform OS'),
  }
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

function readInput(value: unknown): ObservedInput {
  const input = record(value, 'Input')
  switch (input.type) {
    case 'text':
      return { type: 'text', text: string(input.text, 'Input text') }
    case 'localImage':
      return { type: 'localImage', path: string(input.path, 'Image path') }
    case 'image':
      return { type: 'image', url: string(input.url, 'Image URL') }
    default:
      return assert.fail('Unexpected input in the bounded proof')
  }
}

function readItems(value: unknown): Item[] {
  return array(value, 'Turn items').flatMap((entry): Item[] => {
    const item = record(entry, 'Turn item')
    switch (item.type) {
      case 'userMessage':
        return [{ type: 'userMessage', content: array(item.content, 'User input').map(readInput) }]
      case 'agentMessage':
        return [{ type: 'agentMessage', text: string(item.text, 'Agent text') }]
      default:
        return []
    }
  })
}

export function readThread(value: unknown) {
  const thread = record(record(value, 'Thread result').thread, 'Thread')
  return {
    id: string(thread.id, 'Thread ID'),
    turns: array(thread.turns, 'Thread turns').map((entry): HistoryTurn => {
      const turn = record(entry, 'History Turn')
      return { ...readTurn(turn), items: readItems(turn.items) }
    }),
  }
}

export function readInterrupt(value: unknown): void {
  const result = record(value, 'Interrupt result')
  assert.equal(Object.keys(result).length, 0, 'Interrupt response must be empty')
}

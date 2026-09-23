import assert from 'node:assert/strict'
import type { Input } from '../input-items'

// The subset of `codex app-server`'s JSON-RPC protocol this adapter drives, grounded in codex-harness
// 0.147.0's generated schema (`codex app-server generate-json-schema`) and the live proof recorded
// in docs/research/2026-09-09-codex-transport.md.
export type RequestID = string | number
export type ThreadConfiguration = { cwd: string }
export type SkillsListRequest = { cwds: string[]; forceReload: boolean }
export type ThreadSourceKind = 'appServer' | 'cli' | 'exec' | 'subAgent' | 'vscode'
export type RequestParams = {
  initialize: {
    clientInfo: { name: string; title: string; version: string }
    capabilities: { experimentalApi: boolean; requestAttestation: boolean }
  }
  'skills/list': SkillsListRequest
  'thread/start': ThreadConfiguration
  'thread/resume': ThreadConfiguration & { threadId: string }
  'thread/unsubscribe': { threadId: string }
  'thread/list': {
    cursor?: string
    limit?: number
    sourceKinds?: ThreadSourceKind[]
    useStateDbOnly?: boolean
  }
  'thread/read': { threadId: string; includeTurns: boolean }
  'thread/turns/list': {
    threadId: string
    cursor?: string
    limit?: number
    itemsView: 'full'
    sortDirection: 'asc'
  }
  'thread/loaded/list': { cursor?: string; limit: number }
  'turn/start': {
    threadId: string
    input: Input[]
    model: string
    effort: string
    approvalPolicy: 'on-request' | 'never'
    sandboxPolicy: { type: 'readOnly' | 'workspaceWrite' | 'dangerFullAccess' }
  }
  'turn/steer': { threadId: string; input: Input[]; expectedTurnId: string }
  'turn/interrupt': { threadId: string; turnId: string }
  'thread/name/set': { threadId: string; name: string }
  'thread/compact/start': { threadId: string }
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

export function protocolRecord(value: unknown, label: string): Record<string, unknown> {
  assert(object(value), `${label} must be an object`)
  return value
}

export function protocolString(value: unknown, label: string): string {
  assert(typeof value === 'string', `${label} must be a string`)
  return value
}

export function readMessage(line: string): WireMessage {
  const parsed: unknown = JSON.parse(line)
  const message = protocolRecord(parsed, 'Protocol envelope')
  let id: RequestID | undefined
  if (Object.hasOwn(message, 'id')) {
    assert(
      typeof message.id === 'string' || typeof message.id === 'number',
      'Invalid protocol request ID',
    )
    id = message.id
  }
  if (Object.hasOwn(message, 'method')) {
    const method = protocolString(message.method, 'Protocol method')
    assert(method.length > 0, 'Invalid protocol method')
    const params = protocolRecord(message.params, 'Protocol notification/request params')
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
  const error = protocolRecord(message.error, 'Protocol error')
  assert(
    typeof error.code === 'number' && Number.isInteger(error.code),
    'Protocol error is missing its numeric code',
  )
  return {
    ...message,
    id,
    error: {
      ...error,
      code: error.code,
      message: protocolString(error.message, 'Protocol error message'),
    },
  }
}

export function readThreadId(value: unknown): string {
  const thread = protocolRecord(protocolRecord(value, 'Thread result').thread, 'Thread')
  return protocolString(thread.id, 'Thread ID')
}

export function readTurn(value: unknown): Turn {
  const turn = protocolRecord(value, 'Turn')
  const status = turn.status
  assert(
    status === 'completed' ||
      status === 'interrupted' ||
      status === 'failed' ||
      status === 'inProgress',
    'Invalid Turn status',
  )
  return { id: protocolString(turn.id, 'Turn ID'), status, error: turn.error }
}

export function readStartedTurn(value: unknown): Turn {
  return readTurn(protocolRecord(value, 'Turn start result').turn)
}

export function readSteeredTurn(value: unknown): string {
  return protocolString(protocolRecord(value, 'Turn steer result').turnId, 'Steered Turn ID')
}

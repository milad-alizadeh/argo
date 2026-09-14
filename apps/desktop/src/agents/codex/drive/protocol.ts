import assert from 'node:assert/strict'

import type { SessionRosterRow } from '../../../core/sessions/models'
import type { Input } from './input-items'

// The subset of `codex app-server`'s JSON-RPC protocol this adapter drives, grounded in codex-cli
// 0.147.0's generated schema (`codex app-server generate-json-schema`) and the live proof recorded
// in docs/research/2026-09-09-codex-transport.md.
export type RequestID = string | number
export type ThreadConfiguration = { cwd: string }
export type RequestParams = {
  initialize: {
    clientInfo: { name: string; title: string; version: string }
    capabilities: { experimentalApi: boolean; requestAttestation: boolean }
  }
  'thread/start': ThreadConfiguration
  'thread/resume': ThreadConfiguration & { threadId: string }
  'turn/start': {
    threadId: string
    input: Input[]
    model: string
    effort: string
    approvalPolicy: 'on-request' | 'never'
    sandboxPolicy: { type: 'readOnly' | 'workspaceWrite' | 'dangerFullAccess' }
  }
  'turn/interrupt': { threadId: string; turnId: string }
  'thread/name/set': { threadId: string; name: string }
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

function readTurn(value: unknown): Turn {
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

export function readCompletedTurn(message: WireMessage) {
  if (!('method' in message) || message.method !== 'turn/completed') return undefined
  return {
    threadId: protocolString(message.params.threadId, 'Completed Turn thread ID'),
    turn: readTurn(message.params.turn),
  }
}

export function readThreadStatus(
  message: WireMessage,
): { threadId: string; status: SessionRosterRow['status'] } | undefined {
  if (!('method' in message) || message.method !== 'thread/status/changed') return undefined
  const status = protocolRecord(message.params.status, 'Thread status')
  const threadId = protocolString(message.params.threadId, 'Thread status thread ID')
  switch (protocolString(status.type, 'Thread status type')) {
    case 'active':
      assert(
        Array.isArray(status.activeFlags) &&
          status.activeFlags.every((flag) => typeof flag === 'string'),
        'Active thread status has invalid flags',
      )
      if (status.activeFlags.includes('waitingOnApproval')) {
        return { threadId, status: 'permission' }
      }
      if (status.activeFlags.includes('waitingOnUserInput')) return { threadId, status: 'asking' }
      return { threadId, status: 'running' }
    case 'idle':
      return { threadId, status: 'idle' }
    case 'systemError':
    case 'notLoaded':
      return { threadId, status: 'unknown' }
    default:
      assert.fail('Invalid thread status type')
  }
}

export type AgentMessageText = { threadId: string; turnId: string; itemId: string; text: string }

export function readAgentMessageDelta(message: WireMessage): AgentMessageText | undefined {
  if (!('method' in message) || message.method !== 'item/agentMessage/delta') return undefined
  return {
    threadId: protocolString(message.params.threadId, 'Delta thread ID'),
    turnId: protocolString(message.params.turnId, 'Delta Turn ID'),
    itemId: protocolString(message.params.itemId, 'Delta item ID'),
    text: protocolString(message.params.delta, 'Delta text'),
  }
}

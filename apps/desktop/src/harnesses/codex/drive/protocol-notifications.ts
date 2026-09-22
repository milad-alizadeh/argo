import assert from 'node:assert/strict'
import type { CodexThreadStatus } from '@/harnesses/codex/drive/managed-status'
import {
  protocolRecord,
  protocolString,
  readTurn,
  type WireMessage,
} from '@/harnesses/codex/drive/protocol'

export function readCompletedTurn(message: WireMessage) {
  if (!('method' in message) || message.method !== 'turn/completed') return undefined
  return {
    threadId: protocolString(message.params.threadId, 'Completed Turn thread ID'),
    turn: readTurn(message.params.turn),
  }
}

export function readThreadStatus(
  message: WireMessage,
): { threadId: string; status: CodexThreadStatus } | undefined {
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
      return { threadId, status: { type: 'active', activeFlags: status.activeFlags } }
    case 'idle':
      return { threadId, status: { type: 'idle' } }
    case 'systemError':
      return { threadId, status: { type: 'systemError' } }
    case 'notLoaded':
      return { threadId, status: { type: 'notLoaded' } }
    default:
      assert.fail('Invalid thread status type')
  }
}

export function readClosedThread(message: WireMessage): string | undefined {
  if (!('method' in message) || message.method !== 'thread/closed') return undefined
  return protocolString(message.params.threadId, 'Closed thread ID')
}

export type AgentMessageText = { threadId: string; turnId: string; itemId: string; text: string }

export type ToolCallUpdate = {
  threadId: string
  turnId: string
  id: string
  name: string
  status: 'running' | 'completed' | 'failed'
}

export type TokenUsageUpdate = {
  threadId: string
  inputTokens: number
  outputTokens: number
}

export function readAgentMessageDelta(message: WireMessage): AgentMessageText | undefined {
  if (!('method' in message) || message.method !== 'item/agentMessage/delta') return undefined
  return {
    threadId: protocolString(message.params.threadId, 'Delta thread ID'),
    turnId: protocolString(message.params.turnId, 'Delta Turn ID'),
    itemId: protocolString(message.params.itemId, 'Delta item ID'),
    text: protocolString(message.params.delta, 'Delta text'),
  }
}

function toolCallStatus(value: unknown, label: string): ToolCallUpdate['status'] {
  switch (protocolString(value, label)) {
    case 'inProgress':
      return 'running'
    case 'completed':
      return 'completed'
    case 'failed':
    case 'declined':
    case 'interrupted':
      return 'failed'
    default:
      assert.fail(`Invalid tool call status: ${String(value)}`)
  }
}

function toolCallName(item: Record<string, unknown>): string | undefined {
  switch (protocolString(item.type, 'Thread item type')) {
    case 'commandExecution':
      return protocolString(item.command, 'Command execution command')
    case 'mcpToolCall':
    case 'dynamicToolCall':
      return protocolString(item.tool, 'Tool call name')
    default:
      return undefined
  }
}

export function readToolCallUpdate(message: WireMessage): ToolCallUpdate | undefined {
  if (
    !('method' in message) ||
    (message.method !== 'item/started' && message.method !== 'item/completed')
  )
    return undefined
  const item = protocolRecord(message.params.item, 'Thread item')
  const name = toolCallName(item)
  if (name === undefined) return undefined
  return {
    threadId: protocolString(message.params.threadId, 'Tool call thread ID'),
    turnId: protocolString(message.params.turnId, 'Tool call Turn ID'),
    id: protocolString(item.id, 'Tool call ID'),
    name,
    status: toolCallStatus(item.status, 'Tool call status'),
  }
}

export function readThreadTokenUsageUpdated(message: WireMessage): TokenUsageUpdate | undefined {
  if (!('method' in message) || message.method !== 'thread/tokenUsage/updated') return undefined
  const usage = protocolRecord(message.params.tokenUsage, 'Thread token usage')
  const total = protocolRecord(usage.total, 'Total token usage')
  const inputTokens = total.inputTokens
  const outputTokens = total.outputTokens
  assert(
    typeof inputTokens === 'number' && Number.isInteger(inputTokens) && inputTokens >= 0,
    'Total input tokens must be a non-negative integer',
  )
  assert(
    typeof outputTokens === 'number' && Number.isInteger(outputTokens) && outputTokens >= 0,
    'Total output tokens must be a non-negative integer',
  )
  return {
    threadId: protocolString(message.params.threadId, 'Token usage thread ID'),
    inputTokens,
    outputTokens,
  }
}

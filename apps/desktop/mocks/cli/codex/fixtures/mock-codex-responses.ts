import type { ThreadTokenUsageUpdatedNotification } from '@/harnesses/codex/app-server'
import { MOCK_CONTEXT_USAGE } from '../../mock-context-usage.ts'

type Send = (message: Record<string, unknown>) => void

// The token usage every mock Turn reports before it ends.
export function sendTokenUsage(send: Send, threadId: unknown, turnId: string) {
  const { usedTokens, windowTokens } = MOCK_CONTEXT_USAGE.codex
  const last = {
    totalTokens: usedTokens,
    inputTokens: usedTokens - 500,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 500,
    reasoningOutputTokens: 0,
  }
  const params: ThreadTokenUsageUpdatedNotification = {
    threadId: String(threadId),
    turnId,
    tokenUsage: { last, total: last, modelContextWindow: windowTokens },
  }
  send({ method: 'thread/tokenUsage/updated', params })
}

export function completeTurn({
  outcome,
  send,
  threadId,
  turnId,
}: {
  outcome: 'reply' | 'failure'
  send: Send
  threadId: unknown
  turnId: string
}) {
  const status = outcome === 'failure' ? 'failed' : 'completed'
  sendTokenUsage(send, threadId, turnId)
  send({
    method: 'turn/completed',
    params: { threadId, turn: { id: turnId, status, error: null } },
  })
  send({
    method: 'thread/status/changed',
    params: { threadId, status: { type: status === 'failed' ? 'systemError' : 'idle' } },
  })
}

export function compactionItem({
  method,
  send,
  threadCounter,
  threadId,
}: {
  method: 'item/started' | 'item/completed'
  send: Send
  threadCounter: number
  threadId: unknown
}) {
  send({
    method,
    params: {
      threadId,
      turnId: `mock-compact-turn-${threadCounter}`,
      item: { id: `mock-compaction-${threadCounter}`, type: 'contextCompaction' },
    },
  })
}

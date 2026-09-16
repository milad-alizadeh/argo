type Send = (message: Record<string, unknown>) => void

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

import assert from 'node:assert/strict'
import { protocolRecord, protocolString, type WireMessage } from '@/harnesses/codex/drive/protocol'

export function readCompactStart(value: unknown): void {
  const result = protocolRecord(value, 'Compact start result')
  assert.equal(Object.keys(result).length, 0, 'Compact start response must be empty')
}

// `thread/compacted` is deprecated in codex-harness's own schema in favor of a `contextCompaction`
// thread item, so compaction is read the same way as any other item lifecycle notification.
function readCompactionItem(
  message: WireMessage,
  method: 'item/started' | 'item/completed',
): { threadId: string } | undefined {
  if (!('method' in message) || message.method !== method) return undefined
  const item = protocolRecord(message.params.item, `Item in ${method}`)
  if (item.type !== 'contextCompaction') return undefined
  return { threadId: protocolString(message.params.threadId, `Thread ID in ${method}`) }
}

// Live-verified on codex-harness 0.147.0: sent as compaction begins, for `thread/compact/start` and an
// automatic compaction alike.
export function readStartedCompaction(message: WireMessage) {
  return readCompactionItem(message, 'item/started')
}

export function readCompletedCompaction(message: WireMessage) {
  return readCompactionItem(message, 'item/completed')
}

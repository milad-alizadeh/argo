import assert from 'node:assert/strict'
import { protocolRecord, protocolString, type WireMessage } from './protocol'

export function readCompactStart(value: unknown): void {
  const result = protocolRecord(value, 'Compact start result')
  assert.equal(Object.keys(result).length, 0, 'Compact start response must be empty')
}

// `thread/compacted` is deprecated in codex-cli's own schema in favor of a `contextCompaction`
// thread item, so completion is read the same way as any other item lifecycle notification.
export function readCompletedCompaction(message: WireMessage): { threadId: string } | undefined {
  if (!('method' in message) || message.method !== 'item/completed') return undefined
  const item = protocolRecord(message.params.item, 'Completed item')
  if (item.type !== 'contextCompaction') return undefined
  return { threadId: protocolString(message.params.threadId, 'Completed item thread ID') }
}

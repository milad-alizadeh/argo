import type { WireMessage } from '@/harnesses/codex/drive/protocol/protocol'
import { protocolRecord, protocolString } from '@/harnesses/codex/drive/protocol/protocol'

export function readRename(value: unknown): void {
  protocolRecord(value, 'Thread rename result')
}

export function readUpdatedThreadName(message: WireMessage) {
  if (!('method' in message) || message.method !== 'thread/name/updated') return undefined
  return {
    threadId: protocolString(message.params.threadId, 'Updated thread ID'),
    title: protocolString(message.params.threadName, 'Updated thread name'),
  }
}

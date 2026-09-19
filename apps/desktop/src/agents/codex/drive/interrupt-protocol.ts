import assert from 'node:assert/strict'
import { protocolRecord } from '@/agents/codex/drive/protocol'

export function readInterrupt(value: unknown): void {
  const result = protocolRecord(value, 'Interrupt result')
  assert.equal(Object.keys(result).length, 0, 'Interrupt response must be empty')
}

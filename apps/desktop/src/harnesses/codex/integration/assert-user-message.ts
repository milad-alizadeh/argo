import assert from 'node:assert/strict'
import type { ContentBlock, TranscriptRecord } from '@/domains/sessions/contract/transcript'

export function assertUserMessage(
  record: TranscriptRecord | null,
  expected: { uuid: string; blocks: ContentBlock[] },
): void {
  assert.equal(record?.kind, 'message')
  if (record?.kind !== 'message') return
  assert.deepEqual(
    { uuid: record.uuid, role: record.role, blocks: record.blocks },
    { uuid: expected.uuid, role: 'user', blocks: expected.blocks },
  )
}

export function assertMessageBlocks(record: TranscriptRecord | null, blocks: ContentBlock[]): void {
  assert.equal(record?.kind, 'message')
  if (record?.kind !== 'message') return
  assert.deepEqual(record.blocks, blocks)
}

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rosterMetadata } from './roster-metadata'
import type { TranscriptRecord } from './transcript'

test('keeps roster facts while dropping Feed payloads', () => {
  const record: TranscriptRecord = {
    kind: 'message',
    uuid: 'message-1',
    parentUuid: null,
    originSessionId: null,
    role: 'user',
    sidechain: false,
    cwd: '/work',
    branch: 'main',
    timestamp: '2026-09-15T09:00:00.000Z',
    entry: 'interactive',
    stopReason: null,
    model: null,
    effort: null,
    mode: null,
    blocks: [{ shape: 'prose', text: '  First prompt\nThe rest of the Feed.' }],
    toolCalls: [
      {
        id: 'tool-1',
        name: 'Bash',
        input: { command: 'git status', irrelevant: 'x'.repeat(10_000) },
      },
    ],
    toolResults: [
      { callId: 'tool-1', content: 'x'.repeat(10_000), failed: false },
      {
        callId: 'tool-2',
        content: 'x'.repeat(10_000),
        failed: false,
        background: { taskId: 'task-1', outputPath: '/tmp/output' },
      },
    ],
    answeredCalls: ['tool-1'],
    usage: null,
  }

  const metadata = rosterMetadata(record)
  assert.deepEqual(metadata, {
    ...record,
    blocks: [{ shape: 'prose', text: '  First prompt' }],
    toolCalls: [{ id: 'tool-1', name: 'Bash', input: { command: 'git status' } }],
    toolResults: [
      {
        callId: 'tool-2',
        content: null,
        failed: false,
        background: { taskId: 'task-1', outputPath: '/tmp/output' },
      },
    ],
  })
})

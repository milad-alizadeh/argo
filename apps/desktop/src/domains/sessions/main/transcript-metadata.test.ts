import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TranscriptRecord } from '../contract/transcript'
import { rosterMetadata } from './roster-metadata'

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
      { callId: 'tool-1', blocks: [{ shape: 'text', text: 'x'.repeat(10_000) }], failed: false },
      {
        callId: 'tool-2',
        blocks: [{ shape: 'text', text: 'x'.repeat(10_000) }],
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
        blocks: [],
        failed: false,
        background: { taskId: 'task-1', outputPath: '/tmp/output' },
      },
    ],
  })
})

test('keeps a command receipt as the lightweight opening prompt', () => {
  const record: TranscriptRecord = {
    kind: 'message',
    uuid: 'command-1',
    parentUuid: null,
    originSessionId: null,
    role: 'user',
    sidechain: false,
    cwd: null,
    branch: null,
    timestamp: null,
    entry: 'interactive',
    stopReason: null,
    model: null,
    effort: null,
    mode: null,
    blocks: [
      { shape: 'event', event: 'status', text: 'not a title' },
      { shape: 'event', event: 'command', text: '/implement 2178' },
    ],
    toolCalls: [],
    toolResults: [],
    answeredCalls: [],
    usage: null,
  }

  const metadata = rosterMetadata(record)
  assert.equal(metadata.kind, 'message')
  if (metadata.kind !== 'message') assert.fail('expected message metadata')
  assert.deepEqual(metadata.blocks, [{ shape: 'event', event: 'command', text: '/implement 2178' }])
})

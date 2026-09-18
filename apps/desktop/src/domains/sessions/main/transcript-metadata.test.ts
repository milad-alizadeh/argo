import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TranscriptMessage, TranscriptRecord } from '../contract/transcript'
import { rosterMetadata } from './roster-metadata'

function message(overrides: Partial<TranscriptMessage>): TranscriptRecord {
  return {
    kind: 'message',
    uuid: 'message-1',
    parentUuid: null,
    originSessionId: null,
    role: 'assistant',
    sidechain: false,
    cwd: null,
    branch: null,
    timestamp: null,
    entry: 'interactive',
    stopReason: null,
    model: null,
    effort: null,
    mode: null,
    blocks: [],
    toolCalls: [],
    toolResults: [],
    answeredCalls: [],
    usage: null,
    ...overrides,
  }
}

function messageMetadata(record: TranscriptRecord): TranscriptMessage {
  const metadata = rosterMetadata(record)
  if (metadata.kind !== 'message') assert.fail('expected message metadata')
  return metadata
}

test('keeps roster facts while dropping Feed payloads', () => {
  const record = message({
    role: 'user',
    cwd: '/work',
    branch: 'main',
    timestamp: '2026-09-15T09:00:00.000Z',
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
  })

  assert.deepEqual(rosterMetadata(record), {
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

test('keeps the newest headline thought of an assistant message and drops its prose', () => {
  const metadata = messageMetadata(
    message({
      blocks: [
        { shape: 'thought', text: 'Reading the roster' },
        { shape: 'prose', text: 'x'.repeat(10_000) },
        { shape: 'thought', text: 'Planning directory moves ' },
      ],
    }),
  )
  assert.deepEqual(metadata.blocks, [{ shape: 'thought', text: 'Planning directory moves' }])
})

test('keeps the file headers of an apply_patch so the Roster can name the file', () => {
  const metadata = messageMetadata(
    message({
      toolCalls: [
        {
          id: 'patch-1',
          name: 'apply_patch',
          input: {
            patch: `*** Begin Patch\n*** Update File: src/app.ts\n@@\n-${'x'.repeat(10_000)}\n+y\n*** End Patch`,
          },
        },
      ],
    }),
  )
  assert.deepEqual(metadata.toolCalls, [
    { id: 'patch-1', name: 'apply_patch', input: { patch: '*** Update File: src/app.ts' } },
  ])
})

test('keeps a command receipt as the lightweight opening prompt', () => {
  const metadata = messageMetadata(
    message({
      role: 'user',
      blocks: [
        { shape: 'event', event: 'status', text: 'not a title' },
        { shape: 'event', event: 'command', text: '/implement 2178' },
      ],
    }),
  )
  assert.deepEqual(metadata.blocks, [{ shape: 'event', event: 'command', text: '/implement 2178' }])
})

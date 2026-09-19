import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TranscriptMessage, TranscriptRecord } from '../contract/transcript'
import { rosterMetadata } from './roster-metadata'
import { transcriptMessage } from './transcript-test-fixtures'

function message(overrides: Partial<TranscriptMessage>): TranscriptMessage {
  return transcriptMessage({ uuid: 'message-1', ...overrides })
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

test('keeps the files an edit touched and drops its diff', () => {
  const metadata = messageMetadata(
    message({
      toolCalls: [
        {
          id: 'edit-1',
          name: 'files',
          input: {},
          edit: {
            kind: 'edit',
            files: [
              {
                change: 'update',
                file: 'src/app.ts',
                diff: `@@ -1,1 +1,1 @@\n-${'x'.repeat(10_000)}\n+y`,
                lineCounts: { added: 1, removed: 1 },
              },
            ],
          },
        },
      ],
    }),
  )
  assert.deepEqual(metadata.toolCalls[0]?.edit?.files, [
    { change: 'update', file: 'src/app.ts', diff: '', lineCounts: { added: 1, removed: 1 } },
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

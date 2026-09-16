import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readActivity } from './signals'
import type { ToolCall, TranscriptMessage } from './transcript'

function promptMessage(): TranscriptMessage {
  return {
    kind: 'message',
    uuid: 'prompt',
    parentUuid: null,
    originSessionId: null,
    role: 'user',
    sidechain: false,
    cwd: null,
    branch: null,
    timestamp: '2026-09-15T00:00:00.000Z',
    entry: 'interactive',
    stopReason: null,
    model: null,
    effort: null,
    mode: null,
    blocks: [{ shape: 'prose', text: 'do the thing' }],
    toolCalls: [],
    answeredCalls: [],
    usage: null,
  }
}

function callMessage(call: ToolCall): TranscriptMessage {
  return {
    ...promptMessage(),
    uuid: 'call',
    role: 'assistant',
    blocks: [],
    toolCalls: [call],
  }
}

test('names a running Bash call by its own description, not the raw command', () => {
  const activity = readActivity([
    promptMessage(),
    callMessage({
      id: 'call-1',
      name: 'Bash',
      input: {
        command: 'RTK_DISABLED=1 gh pr checks 2062 --watch',
        description: 'Watch PR checks',
      },
    }),
  ])
  assert.deepEqual(activity, {
    label: 'Watch PR checks',
    tool: 'Bash',
    target: 'Watch PR checks',
  })
})

test('names a running Bash call by its command when no description was given', () => {
  const activity = readActivity([
    promptMessage(),
    callMessage({ id: 'call-1', name: 'Bash', input: { command: 'bun run quality' } }),
  ])
  assert.deepEqual(activity, {
    label: 'Ran bun run quality',
    tool: 'Bash',
    target: 'bun run quality',
  })
})

test('uses the Feed label for a non-command tool while retaining its activity metadata', () => {
  const activity = readActivity([
    promptMessage(),
    callMessage({ id: 'call-1', name: 'Read', input: { file_path: '/workspace/src/app.ts' } }),
  ])
  assert.deepEqual(activity, {
    label: 'Read /workspace/src/app.ts',
    tool: 'Read',
    target: 'app.ts',
  })
})

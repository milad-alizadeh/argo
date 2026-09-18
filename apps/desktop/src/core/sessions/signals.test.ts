import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readActivity } from './signals'
import type { ToolCall, ToolResult, TranscriptMessage } from './transcript'

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

function resultMessage(callId: string, result: ToolResult): TranscriptMessage {
  return {
    ...promptMessage(),
    uuid: 'result',
    role: 'user',
    blocks: [],
    toolResults: [result],
    answeredCalls: [callId],
  }
}

// The newest call of a Turn the transcript has not answered yet.
function openActivity(name: string, input: ToolCall['input']) {
  return readActivity([promptMessage(), callMessage({ id: 'call-1', name, input })])
}

test('names a running Bash call by its own description, not the raw command', () => {
  const command = 'RTK_DISABLED=1 gh pr checks 2062 --watch'
  assert.deepEqual(openActivity('Bash', { command, description: 'Watch PR checks' }), {
    label: 'Watch PR checks',
    kind: 'command',
    open: true,
    tool: 'Bash',
    target: 'Watch PR checks',
  })
})

test('names a running Bash call by its command when no description was given', () => {
  assert.deepEqual(openActivity('Bash', { command: 'bun run quality' }), {
    label: 'Ran bun run quality',
    kind: 'command',
    open: true,
    tool: 'Bash',
    target: 'bun run quality',
  })
})

test('uses the Feed label for a non-command tool while retaining its activity metadata', () => {
  assert.deepEqual(openActivity('Read', { file_path: '/workspace/src/app.ts' }), {
    label: 'Read app.ts',
    kind: 'read',
    open: true,
    tool: 'Read',
    target: 'app.ts',
  })
})

test('reads a call closed once the transcript holds its result', () => {
  const activity = readActivity([
    promptMessage(),
    callMessage({ id: 'call-1', name: 'Bash', input: { command: 'bun run quality' } }),
    resultMessage('call-1', { callId: 'call-1', blocks: [], failed: false }),
  ])
  assert.equal(activity?.open, false)
})

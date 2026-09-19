import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readActivity } from '../contract/signals'
import type { ToolCall, ToolResult, TranscriptMessage } from '../contract/transcript'

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
    callMessage({
      id: 'call-1',
      name: 'command',
      input: {},
      execute: {
        kind: 'execute',
        command: 'bun run quality',
        label: null,
        text: 'bun run quality',
        background: false,
      },
    }),
    resultMessage('call-1', { callId: 'call-1', blocks: [], failed: false }),
  ])
  assert.equal(activity?.open, false)
})

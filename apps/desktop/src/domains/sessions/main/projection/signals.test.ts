import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  ToolCall,
  ToolResult,
  TranscriptMessage,
} from '@/domains/sessions/contract/model/transcript'
import { readActivity } from '@/domains/sessions/contract/observation/signals'
import { readCall } from './tool-feed-test-fixtures'

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

test('uses the Feed label for a non-command tool while retaining its activity metadata', () => {
  const activity = readActivity([
    promptMessage(),
    callMessage(readCall('call-1', '/workspace/src/app.ts')),
  ])
  assert.deepEqual(activity, {
    label: 'Read app.ts',
    kind: 'read',
    open: true,
    tool: 'read',
    target: 'app.ts',
  })
})

test('reads a call closed once the transcript holds its result', () => {
  const activity = readActivity([
    promptMessage(),
    callMessage({
      id: 'call-1',
      kind: 'execute',
      command: 'bun run quality',
      label: null,
      text: 'bun run quality',
      background: false,
    }),
    resultMessage('call-1', { callId: 'call-1', blocks: [], failed: false }),
  ])
  assert.equal(activity?.open, false)
})

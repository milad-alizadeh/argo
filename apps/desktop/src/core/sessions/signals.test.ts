import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readActivity, readDelegations } from './signals'
import type { BackgroundTaskRecord, ToolCall, ToolResult, TranscriptMessage } from './transcript'

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

function backgroundNotification(callId: string, state: BackgroundTaskRecord['state']) {
  return {
    kind: 'background-task' as const,
    taskId: 'task-1',
    callId,
    outputPath: null,
    state,
    summary: null,
    timestamp: '2026-09-16T00:05:00.000Z',
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
    label: 'Read app.ts',
    tool: 'Read',
    target: 'app.ts',
  })
})

function delegationMessages(result: ToolResult): TranscriptMessage[] {
  const call: ToolCall = { id: 'call-agent', name: 'Task', input: { description: 'sweep' } }
  return [promptMessage(), callMessage(call), resultMessage('call-agent', result)]
}

test('reads a foreground Subagent as landed as soon as its result comes back', () => {
  const messages = delegationMessages({ callId: 'call-agent', content: 'done', failed: false })
  assert.equal(readDelegations(messages, [])[0]?.landed, true)
})

test('reads a backgrounded Subagent as still running until its completion notification lands', () => {
  const messages = delegationMessages({
    callId: 'call-agent',
    content: 'Async agent launched successfully.',
    failed: false,
    background: { taskId: 'task-1', outputPath: null },
  })
  assert.equal(readDelegations(messages, [])[0]?.landed, false)
  const notified = readDelegations(messages, [backgroundNotification('call-agent', 'completed')])
  assert.equal(notified[0]?.landed, true)
})

test('reads Codex subagent activity as a delegation that can open its transcript', () => {
  assert.deepEqual(
    readDelegations(
      [],
      [],
      [
        {
          kind: 'delegation',
          uuid: 'activity-completed',
          actor: 'agent',
          action: 'review_feed',
          status: 'completed',
          progress: null,
          groupId: 'subagent-thread',
          callId: null,
        },
      ],
    ),
    [
      {
        id: 'subagent-thread',
        label: 'review_feed',
        landed: true,
        startedAt: null,
        endedAt: null,
      },
    ],
  )
})

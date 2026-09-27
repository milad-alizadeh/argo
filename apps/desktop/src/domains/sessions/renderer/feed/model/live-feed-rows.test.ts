import { expect, test } from 'bun:test'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionLiveEvent } from '@/domains/sessions/api/session-live-event'
import { projectLiveFeedRows } from './live-feed-rows'

const sessionId = '00000000-0000-4000-8000-000000000001'
function content(sequence: number, value: FeedContent): SessionLiveEvent {
  return {
    type: 'content',
    sessionId,
    sequence,
    commandId: 'command-1',
    turnId: 'turn-1',
    vendorEventId: value.id,
    content: value,
  }
}

function status(sequence: number, value: 'running' | 'idle'): SessionLiveEvent {
  return {
    type: 'status',
    sessionId,
    sequence,
    commandId: 'command-1',
    turnId: 'turn-1',
    vendorEventId: null,
    status: value,
  }
}

function question(
  sequence: number,
  requestId: string,
  vendorEventId: string | null,
): SessionLiveEvent {
  return {
    type: 'question',
    sessionId,
    sequence,
    commandId: 'command-1',
    turnId: 'turn-1',
    vendorEventId,
    requestId,
    questions: [{ question: 'Which file?', header: null, multiSelect: false, options: [] }],
    answer: null,
  }
}

test('shows ordered live text, tool work, status, Permission, and Question rows', () => {
  const rows = projectLiveFeedRows(
    [],
    [
      content(1, { kind: 'message', id: 'prompt-1', role: 'user', text: 'Inspect this' }),
      {
        type: 'status',
        sessionId,
        sequence: 2,
        commandId: 'command-1',
        turnId: 'turn-1',
        vendorEventId: null,
        status: 'running',
      },
      content(3, { kind: 'message', id: 'answer-1', role: 'assistant', text: 'Reading now' }),
      content(4, {
        kind: 'tool',
        id: 'tool-1',
        callId: 'call-1',
        name: 'Read',
        status: 'running',
        input: null,
        output: null,
        summary: null,
      }),
      {
        type: 'permission',
        sessionId,
        sequence: 5,
        commandId: 'command-1',
        turnId: 'turn-1',
        vendorEventId: null,
        requestId: 'permission-1',
        description: 'Read this file?',
      },
      question(6, 'question-1', null),
    ],
  )
  expect(rows.map((row) => [row.shape, row.id])).toEqual([
    ['prose', 'prompt-1'],
    ['event', 'status:2'],
    ['prose', 'answer-1'],
    ['tool', 'call-1'],
    ['event', 'permission-1'],
    ['ask', 'question-1'],
  ])
})

test('settled vendor history replaces matching live messages and tool progress', () => {
  const history: FeedContent[] = [
    { kind: 'message', id: 'prompt-1', role: 'user', text: 'Inspect this' },
    { kind: 'message', id: 'answer-1', role: 'assistant', text: 'Final answer' },
    {
      kind: 'tool',
      id: 'tool-result-1',
      callId: 'call-1',
      name: 'Read',
      status: 'completed',
      input: null,
      output: [{ kind: 'text', text: 'file contents' }],
      summary: null,
    },
  ]
  const live = [
    content(1, { kind: 'message', id: 'prompt-1', role: 'user', text: 'Inspect this' }),
    content(2, { kind: 'message', id: 'answer-1', role: 'assistant', text: 'Reading now' }),
    content(3, {
      kind: 'tool',
      id: 'tool-progress-1',
      callId: 'call-1',
      name: 'Read',
      status: 'running',
      input: null,
      output: null,
      summary: null,
    }),
    status(4, 'idle'),
  ]
  const rows = projectLiveFeedRows(history, live)
  expect(rows).toHaveLength(4)
  expect(rows[1]).toMatchObject({ shape: 'prose', text: 'Final answer' })
  expect(rows[2]).toMatchObject({
    shape: 'tool',
    id: 'call-1',
    status: 'succeeded',
    evidence: { source: 'file contents' },
  })
})

test('interleaves live status with matching history while active text and tools keep updating', () => {
  const history: FeedContent[] = [
    { kind: 'message', id: 'old-1', role: 'assistant', text: 'Earlier turn' },
    { kind: 'message', id: 'prompt-1', role: 'user', text: 'Inspect this' },
    { kind: 'message', id: 'answer-1', role: 'assistant', text: 'Old text' },
    {
      kind: 'tool',
      id: 'tool-1',
      callId: 'call-1',
      name: 'Read',
      status: 'running',
      input: null,
      output: null,
      summary: null,
    },
  ]
  const rows = projectLiveFeedRows(history, [
    content(1, { kind: 'message', id: 'prompt-1', role: 'user', text: 'Inspect this' }),
    status(2, 'running'),
    content(3, { kind: 'message', id: 'answer-1', role: 'assistant', text: 'Growing text' }),
    {
      type: 'permission',
      sessionId,
      sequence: 4,
      commandId: 'command-1',
      turnId: 'turn-1',
      vendorEventId: 'call-1',
      requestId: 'permission-1',
      description: 'Read file',
    },
    content(5, {
      kind: 'tool',
      id: 'tool-1',
      callId: 'call-1',
      name: 'Read',
      status: 'completed',
      input: null,
      output: null,
      summary: null,
    }),
    status(6, 'running'),
  ])
  expect(rows.map((row) => row.id)).toEqual([
    'old-1',
    'prompt-1',
    'status:2',
    'answer-1',
    'permission-1',
    'call-1',
    'status:6',
  ])
  expect(rows[3]).toMatchObject({ text: 'Growing text' })
  expect(rows[5]).toMatchObject({ status: 'succeeded' })
})

test('shows a Claude Question once when vendor history includes its tool call', () => {
  const tool: FeedContent = {
    kind: 'tool',
    id: 'question-tool',
    callId: 'question-call',
    name: 'AskUserQuestion',
    status: 'completed',
    input: null,
    output: null,
    summary: null,
  }
  const rows = projectLiveFeedRows(
    [tool],
    [content(1, tool), question(2, 'question-1', 'question-call')],
  )
  expect(rows.map((row) => [row.shape, row.id])).toEqual([['ask', 'question-1']])
})

import { expect, test } from 'bun:test'
import { liveContent, liveStatus } from '@/mocks/sessions/live-events.fixture'
import type { FeedContent } from '../feed-content'
import type { SessionLiveEvent } from '../session-live-event'
import { projectLiveFeedRows } from './live-feed-rows'
import { groupToolRuns } from './tool-groups'

const sessionId = '00000000-0000-4000-8000-000000000001'

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

test('draws an authored prompt with its images, files, and pasted content as one row', () => {
  const rows = projectLiveFeedRows(
    [
      {
        kind: 'message',
        id: 'prompt-1',
        role: 'user',
        text: 'See attached',
        images: [{ kind: 'data', mimeType: 'image/png', base64: 'aGVsbG8=' }],
        files: [{ label: 'report.pdf', target: '/repo/report.pdf' }],
        pastedContent: [{ id: 'pasted-1', text: 'Pasted body' }],
      },
    ],
    [],
  )
  expect(rows).toEqual([
    {
      shape: 'prose',
      id: 'prompt-1',
      role: 'user',
      text: 'See attached',
      images: ['data:image/png;base64,aGVsbG8='],
      files: ['/repo/report.pdf'],
      pastedContent: [{ id: 'pasted-1', text: 'Pasted body' }],
    },
  ])
})

test('shows ordered live text, tool work, status, Permission, and Question rows', () => {
  const rows = projectLiveFeedRows(
    [],
    [
      liveContent(1, { kind: 'message', id: 'prompt-1', role: 'user', text: 'Inspect this' }),
      {
        type: 'status',
        sessionId,
        sequence: 2,
        commandId: 'command-1',
        turnId: 'turn-1',
        vendorEventId: null,
        status: 'running',
      },
      liveContent(3, { kind: 'message', id: 'answer-1', role: 'assistant', text: 'Reading now' }),
      liveContent(4, {
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
        decision: null,
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

test('replaces a pending Permission with its resolved decision', () => {
  const pending: SessionLiveEvent = {
    type: 'permission',
    sessionId,
    sequence: 1,
    commandId: 'command-1',
    turnId: 'turn-1',
    vendorEventId: 'tool-1',
    requestId: 'permission-1',
    description: 'Read this file?',
    decision: null,
  }
  expect(projectLiveFeedRows([], [pending])).toMatchObject([
    { id: 'permission-1', event: 'permission' },
  ])
  expect(
    projectLiveFeedRows([], [pending, { ...pending, sequence: 2, decision: 'allow' }]),
  ).toMatchObject([{ id: 'permission-1', event: 'permissionGranted' }])
})

test('keeps raw vendor failures out of the reader-facing Feed row', () => {
  const rows = projectLiveFeedRows(
    [],
    [
      {
        type: 'failure',
        sessionId,
        sequence: 1,
        commandId: 'command-1',
        turnId: 'turn-1',
        vendorEventId: null,
        detail: 'SDK internal path /private/example',
      },
    ],
  )
  expect(rows).toMatchObject([{ event: 'liveFailure', text: null }])
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
    liveContent(1, { kind: 'message', id: 'prompt-1', role: 'user', text: 'Inspect this' }),
    liveContent(2, { kind: 'message', id: 'answer-1', role: 'assistant', text: 'Reading now' }),
    liveContent(3, {
      kind: 'tool',
      id: 'tool-progress-1',
      callId: 'call-1',
      name: 'Read',
      status: 'running',
      input: null,
      output: null,
      summary: null,
    }),
    liveStatus(4, 'idle'),
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
    liveContent(1, { kind: 'message', id: 'prompt-1', role: 'user', text: 'Inspect this' }),
    liveStatus(2, 'running'),
    liveContent(3, { kind: 'message', id: 'answer-1', role: 'assistant', text: 'Growing text' }),
    {
      type: 'permission',
      sessionId,
      sequence: 4,
      commandId: 'command-1',
      turnId: 'turn-1',
      vendorEventId: 'call-1',
      requestId: 'permission-1',
      description: 'Read file',
      decision: null,
    },
    liveContent(5, {
      kind: 'tool',
      id: 'tool-1',
      callId: 'call-1',
      name: 'Read',
      status: 'completed',
      input: null,
      output: null,
      summary: null,
    }),
    liveStatus(6, 'running'),
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
    [liveContent(1, tool), question(2, 'question-1', 'question-call')],
  )
  expect(rows.map((row) => [row.shape, row.id])).toEqual([['ask', 'question-1']])
})

const catalogHistory: FeedContent[] = [
  { kind: 'message', id: 'message', role: 'assistant', text: 'Answer' },
  { kind: 'reasoning', id: 'reasoning', text: 'Thinking' },
  {
    kind: 'media',
    id: 'media',
    mediaType: 'image',
    source: { kind: 'data', mimeType: 'image/png', base64: 'aGVsbG8=' },
    role: 'user',
  },
  {
    kind: 'reference',
    id: 'reference',
    referenceType: 'file',
    label: 'File',
    target: '/repo/feed.ts',
    text: null,
  },
  {
    kind: 'tool',
    id: 'tool',
    callId: 'tool-call',
    name: 'Read',
    status: 'completed',
    input: null,
    output: null,
    summary: null,
  },
  {
    kind: 'command',
    id: 'command',
    command: 'ls',
    status: 'completed',
    output: 'feed.ts',
    stderr: null,
  },
  {
    kind: 'fileChange',
    id: 'fileChange',
    status: 'completed',
    changes: [{ path: '/repo/feed.ts', change: 'update', diff: '+line' }],
  },
  { kind: 'plan', id: 'plan', text: 'Check the Feed' },
  {
    kind: 'delegation',
    id: 'delegation',
    event: 'started',
    agentId: 'agent-1',
    status: 'running',
    name: null,
    prompt: 'Review',
    model: null,
    summary: null,
  },
  {
    kind: 'task',
    id: 'task',
    taskId: 'task-1',
    callId: null,
    status: 'paused',
    description: 'Inspect',
    summary: null,
  },
  {
    kind: 'notification',
    id: 'notification',
    text: 'Connected',
  },
  { kind: 'marker', id: 'marker', marker: 'compaction', summary: 'Earlier work' },
  { kind: 'refusal', id: 'refusal', text: 'Permission denied' },
  {
    kind: 'imageGeneration',
    id: 'imageGeneration',
    status: 'failed',
    prompt: 'A map',
    source: null,
    failure: 'No image',
  },
  { kind: 'wait', id: 'wait', durationMs: 500 },
  { kind: 'diagnostic', id: 'diagnostic', vendorType: 'unknownItem', detail: 'Unsupported' },
]

test('draws no row for a system context update, live or recorded', () => {
  const context: FeedContent[] = [
    { kind: 'context', id: 'reminder', source: 'system', text: 'Hand off to the reviewer' },
  ]
  const prompt: FeedContent = { kind: 'message', id: 'prompt', role: 'user', text: 'Go' }
  expect(
    projectLiveFeedRows(
      [...context, prompt],
      context.map((item, index) => liveContent(index + 1, item)),
    ),
  ).toEqual([{ shape: 'prose', id: 'prompt', role: 'user', text: 'Go' }])
})

test('draws every FeedContent kind with a stable item identity', () => {
  const rows = projectLiveFeedRows(catalogHistory, [])
  expect(rows.map((row) => row.id)).toEqual(
    catalogHistory.map((item) => {
      if (item.kind === 'tool') return item.callId
      if (item.kind === 'task') return item.taskId
      return item.id
    }),
  )
  expect(rows.find((row) => row.id === 'delegation')).toMatchObject({
    shape: 'subagent',
    event: 'started',
  })
  expect(rows.find((row) => row.id === 'task-1')).toMatchObject({ status: 'paused' })
  expect(rows.find((row) => row.id === 'imageGeneration')).toMatchObject({ status: 'failed' })
})

test('joins task and delegation progress by native ID without losing earlier details', () => {
  const rows = projectLiveFeedRows(
    [],
    [
      liveContent(1, {
        kind: 'task',
        id: 'task-1',
        taskId: 'task-1',
        callId: null,
        status: 'running',
        description: 'Inspect files',
        summary: null,
      }),
      liveContent(2, {
        kind: 'delegation',
        id: 'agent-1',
        event: 'started',
        agentId: 'agent-1',
        status: 'running',
        name: 'Review files',
        prompt: 'Review files',
        model: 'small',
        summary: null,
      }),
      liveContent(3, {
        kind: 'task',
        id: 'task-progress-2',
        taskId: 'task-1',
        callId: null,
        status: 'completed',
        description: null,
        summary: null,
      }),
      liveContent(4, {
        kind: 'delegation',
        id: 'agent-1',
        event: 'started',
        agentId: 'agent-1',
        status: 'running',
        name: null,
        prompt: null,
        model: null,
        summary: null,
      }),
    ],
  )
  expect(rows.map((row) => row.id)).toEqual(['task-1', 'agent-1'])
  expect(rows).toMatchObject([
    { event: 'task', text: 'Inspect files', status: 'completed' },
    { shape: 'subagent', event: 'started', name: 'Review files', prompt: 'Review files' },
  ])
})

test('keeps Codex commentary inside the tool group it follows', () => {
  const rows = groupToolRuns(
    projectLiveFeedRows(
      [
        {
          kind: 'tool',
          id: 'tool-1',
          callId: 'call-1',
          name: 'Bash',
          status: 'completed',
          input: null,
          output: null,
          summary: null,
        },
        {
          kind: 'message',
          id: 'commentary-1',
          role: 'assistant',
          phase: 'commentary',
          text: 'Checking the result',
        },
      ],
      [],
    ),
  )
  expect(rows).toMatchObject([
    {
      shape: 'tool-group',
      thoughts: [{ id: 'commentary-1', text: 'Checking the result' }],
    },
  ])
})

test('draws a skill reference as a skill invocation and other references as context', () => {
  const rows = projectLiveFeedRows(
    [
      {
        id: 'skill-1',
        kind: 'reference',
        referenceType: 'skill',
        label: 'tdd',
        target: '/repo/.claude/skills/tdd/SKILL.md',
        text: 'red green',
      },
      {
        id: 'skill-2',
        kind: 'reference',
        referenceType: 'skill',
        label: 'ship',
        target: null,
        text: null,
      },
      {
        id: 'pasted-1',
        kind: 'reference',
        referenceType: 'memory',
        label: 'Pasted content',
        target: null,
        text: 'the pasted words',
      },
    ],
    [],
  )
  expect(rows).toEqual([
    {
      shape: 'event',
      id: 'skill-1',
      event: 'skill-invocation',
      text: 'tdd red green',
      skill: { name: 'tdd', path: '/repo/.claude/skills/tdd/SKILL.md' },
    },
    { shape: 'event', id: 'skill-2', event: 'skill-invocation', text: 'ship' },
    { shape: 'event', id: 'pasted-1', event: 'context', text: 'the pasted words' },
  ])
})

import { expect, test } from 'bun:test'
import { groupToolRuns } from '@/domains/sessions/api/feed/tool-groups'
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

test('updates one Codex Turn status row by vendor identity', () => {
  const running = { ...status(1, 'running'), vendorEventId: 'turn-1' }
  const idle = { ...status(2, 'idle'), vendorEventId: 'turn-1' }
  expect(projectLiveFeedRows([], [running, idle])).toMatchObject([
    { id: 'status:turn-1', text: 'idle' },
  ])
})

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

test('uses product status events instead of raw vendor status strings', () => {
  const rows = projectLiveFeedRows(
    [
      {
        id: 'native-status',
        kind: 'notification',
        category: 'status',
        text: 'SessionStart:resume',
        priority: null,
      },
    ],
    [status(1, 'running')],
  )
  expect(rows).toMatchObject([{ event: 'liveStatus', text: 'running' }])
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
      decision: null,
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

const catalogHistory: FeedContent[] = [
  { kind: 'message', id: 'message', role: 'assistant', text: 'Answer' },
  { kind: 'reasoning', id: 'reasoning', text: 'Thinking', redacted: false },
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
    cwd: '/repo',
    status: 'completed',
    output: 'feed.ts',
    stderr: null,
    exitCode: 0,
  },
  {
    kind: 'fileChange',
    id: 'fileChange',
    status: 'completed',
    changes: [{ path: '/repo/feed.ts', change: 'update', diff: '+line' }],
  },
  { kind: 'search', id: 'search', query: 'Feed', action: null, results: [] },
  { kind: 'plan', id: 'plan', text: 'Check the Feed' },
  {
    kind: 'delegation',
    id: 'delegation',
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
    category: 'info',
    text: 'Connected',
    priority: null,
  },
  { kind: 'context', id: 'context', source: 'environment', text: 'Workspace ready' },
  { kind: 'marker', id: 'marker', marker: 'compaction', summary: 'Earlier work' },
  { kind: 'refusal', id: 'refusal', reason: 'permission', text: 'Permission denied' },
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

test('shows added and deleted file contents on their respective diff sides', () => {
  const rows = projectLiveFeedRows(
    [
      {
        kind: 'fileChange',
        id: 'patch-1',
        status: 'completed',
        changes: [
          { path: '/repo/new.ts', change: 'add', diff: 'first\n\nlast\n' },
          { path: '/repo/old.ts', change: 'delete', diff: 'goodbye\n' },
          { path: '/repo/changed.ts', change: 'update', diff: '@@ -1 +1 @@\n-old\n+new' },
        ],
      },
    ],
    [],
  )
  expect(rows[0]).toMatchObject({
    shape: 'tool',
    evidence: {
      kind: 'diff',
      source: [
        'Add File: /repo/new.ts',
        '@@ -0,0 +1,3 @@',
        '+first',
        '+',
        '+last',
        'Delete File: /repo/old.ts',
        '@@ -1,1 +0,0 @@',
        '-goodbye',
        'Update File: /repo/changed.ts',
        '@@ -1 +1 @@',
        '-old',
        '+new',
      ].join('\n'),
    },
  })
})

test('joins task and delegation progress by native ID without losing earlier details', () => {
  const rows = projectLiveFeedRows(
    [],
    [
      content(1, {
        kind: 'task',
        id: 'task-1',
        taskId: 'task-1',
        callId: null,
        status: 'running',
        description: 'Inspect files',
        summary: null,
      }),
      content(2, {
        kind: 'delegation',
        id: 'agent-1',
        agentId: 'agent-1',
        status: 'running',
        name: 'Review files',
        prompt: 'Review files',
        model: 'small',
        summary: null,
      }),
      content(3, {
        kind: 'task',
        id: 'task-progress-2',
        taskId: 'task-1',
        callId: null,
        status: 'completed',
        description: null,
        summary: null,
      }),
      content(4, {
        kind: 'delegation',
        id: 'agent-1',
        agentId: 'agent-1',
        status: 'completed',
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
    { shape: 'subagent', event: 'responded', state: 'completed', name: 'Review files' },
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

test('draws one Subagent row per delegation, updated in place as its status changes', () => {
  const delegation = (status: 'running' | 'completed'): FeedContent => ({
    id: 'call-agent',
    kind: 'delegation',
    agentId: 'agent-7',
    status,
    prompt: 'Survey the adapters',
    model: 'sonnet',
    name: 'Survey adapters',
    summary: status === 'completed' ? 'Found two adapters' : null,
  })
  expect(projectLiveFeedRows([delegation('running')], [])).toEqual([
    {
      shape: 'subagent',
      id: 'call-agent',
      subagentId: 'agent-7',
      event: 'started',
      name: 'Survey adapters',
      model: 'sonnet',
    },
  ])
  expect(projectLiveFeedRows([delegation('running'), { ...delegation('completed') }], [])).toEqual([
    {
      shape: 'subagent',
      id: 'call-agent',
      subagentId: 'agent-7',
      event: 'responded',
      state: 'completed',
      name: 'Survey adapters',
      model: 'sonnet',
      text: 'Found two adapters',
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
        referenceType: 'pasted',
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

import { expect, test } from 'bun:test'
import type { FeedContent } from '../feed-content'
import { feedContentKindSchema } from '../feed-content'
import type { SessionLiveEvent } from '../session-live-event'
import { FeedRowProjector, projectFeedRowEntries } from './feed-row-entries'
import type { SessionFeedRow } from './feed-rows'
import { projectLiveFeedRows } from './live-feed-rows'
import { foldSettledToolRuns, groupToolRuns } from './tool-groups'

const sessionId = '00000000-0000-4000-8000-000000000001'

function message(id: string, role: 'user' | 'assistant', text: string): FeedContent {
  return { kind: 'message', id, role, text }
}

function live(sequence: number, content: FeedContent): SessionLiveEvent {
  return {
    type: 'content',
    sessionId,
    sequence,
    commandId: null,
    turnId: null,
    vendorEventId: content.id,
    content,
  }
}

const attachment: FeedContent = {
  kind: 'media',
  id: 'i1',
  mediaType: 'image',
  role: 'user',
  source: { kind: 'path', path: '/tmp/a.png' },
}

const durableKinds: FeedContent[] = [
  message('m1', 'user', 'Hello'),
  { kind: 'reasoning', id: 'r1', text: 'Thinking', redacted: false },
  attachment,
  {
    kind: 'reference',
    id: 'ref1',
    referenceType: 'skill',
    label: 'tdd',
    target: '/s/tdd',
    text: null,
  },
  {
    kind: 'tool',
    id: 't1',
    callId: 'call-1',
    name: 'Grep',
    status: 'completed',
    input: null,
    output: null,
    summary: null,
  },
  {
    kind: 'command',
    id: 'c1',
    command: 'ls',
    cwd: null,
    status: 'completed',
    output: 'a',
    stderr: null,
    exitCode: 0,
  },
  {
    kind: 'fileChange',
    id: 'f1',
    status: 'completed',
    changes: [{ path: '/a.ts', change: 'add', diff: 'x' }],
  },
  { kind: 'search', id: 's1', query: 'q', action: null, results: [] },
  { kind: 'plan', id: 'p1', text: 'Plan' },
  {
    kind: 'delegation',
    id: 'd1',
    event: 'started',
    agentId: 'agent-1',
    status: 'running',
    name: null,
    prompt: null,
    model: null,
    summary: null,
  },
  {
    kind: 'task',
    id: 'k1',
    taskId: 'task-1',
    callId: null,
    status: 'running',
    description: 'Task',
    summary: null,
  },
  { kind: 'notification', id: 'n1', category: 'info', text: 'Note', priority: null },
  { kind: 'context', id: 'x1', source: 'hook', text: 'Context' },
  { kind: 'marker', id: 'mk1', marker: 'compaction', summary: null },
  { kind: 'refusal', id: 'rf1', reason: 'model', text: null },
  {
    kind: 'imageGeneration',
    id: 'g1',
    status: 'completed',
    prompt: 'cat',
    source: null,
    failure: null,
  },
  { kind: 'wait', id: 'w1', durationMs: 5 },
  { kind: 'diagnostic', id: 'dg1', vendorType: 'odd', detail: 'detail' },
]

// A grouped tool run stands for its calls and thoughts, in source order.
function memberIds({ row }: { row: { shape: string; id: string } }): string[] {
  if (row.shape !== 'tool-group') return [row.id]
  const group = row as Extract<SessionFeedRow, { shape: 'tool-group' }>
  const thoughtsAfter = (index: number) =>
    (group.thoughts ?? []).filter((thought) => (thought.afterCallIndex ?? -1) === index)
  return [
    ...thoughtsAfter(-1).map((thought) => thought.id),
    ...group.calls.flatMap((call, index) => [
      call.id,
      ...thoughtsAfter(index).map((thought) => thought.id),
    ]),
  ]
}

// A tool row is named by its call, a task row by its task.
function stableId(content: FeedContent): string[] {
  if (content.kind === 'tool') return [content.callId]
  if (content.kind === 'task') return [content.taskId]
  return [content.id]
}

test('every durable content kind projects to a valid entry, in history order', () => {
  const { entries, rejected } = projectFeedRowEntries({
    history: durableKinds,
    live: [],
  })
  expect(rejected).toEqual({ history: 0, live: 0, rows: 0 })
  expect(entries.filter(({ row }) => row.shape !== 'activity').flatMap(memberIds)).toEqual(
    durableKinds
      // A status notice and a system context update are for the model, not the reader.
      .filter((content) => content.kind !== 'notification' || content.category !== 'status')
      .filter((content) => content.kind !== 'context')
      .flatMap((content) => stableId(content)),
  )
  expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length)
})

test('a prompt attachment draws as a user image row', () => {
  const { entries } = projectFeedRowEntries({ history: [attachment], live: [] })
  expect(entries[0]?.row).toMatchObject({ shape: 'image', role: 'user' })
})

test('ids and revisions are stable across projections of the same input', () => {
  const input = {
    history: [message('m1', 'user', 'Hi'), message('m2', 'assistant', 'Yo')],
    live: [],
  }
  expect(projectFeedRowEntries(input).entries).toEqual(projectFeedRowEntries(input).entries)
})

test('a changed row keeps its id and changes its revision', () => {
  const project = (text: string) =>
    projectFeedRowEntries({ history: [message('m1', 'assistant', text)], live: [] }).entries[0]
  expect(project('One two')?.id).toBe(project('One')?.id)
  expect(project('One two')?.revision).not.toBe(project('One')?.revision)
})

test('history and live inputs reconcile into one row each, in history order', () => {
  const { entries } = projectFeedRowEntries({
    history: [message('m1', 'user', 'Hi'), message('m2', 'assistant', 'Done')],
    live: [
      live(1, message('m2', 'assistant', 'Done')),
      live(2, message('m3', 'assistant', 'More')),
    ],
  })
  expect(entries.map((entry) => entry.row.id)).toEqual(['m1', 'm2', 'm3'])
})

function tool(callId: string, status: 'running' | 'completed'): FeedContent {
  return {
    kind: 'tool',
    id: callId,
    callId,
    name: 'Grep',
    status,
    input: null,
    output: null,
    summary: `Searched ${callId}`,
  }
}

const thought = (id: string, text: string): FeedContent => ({
  kind: 'reasoning',
  id,
  text,
  redacted: false,
})

test('one transient activity row ends the rows with the Turn latest call', () => {
  const { entries, activity } = projectFeedRowEntries({
    history: [
      message('m1', 'user', 'Hi'),
      thought('r1', 'Reading the code'),
      tool('c1', 'running'),
    ],
    live: [],
  })
  expect(activity).toMatchObject({ label: 'Searched c1', kind: 'tool', open: true })
  expect(entries.at(-1)).toMatchObject({ id: 'activity', row: { shape: 'activity', activity } })
  expect(entries.filter((entry) => entry.row.shape === 'activity')).toHaveLength(1)
})

test('a newer thought replaces the call as the activity, and a new Turn starts empty', () => {
  const history = [
    message('m1', 'user', 'Hi'),
    tool('c1', 'completed'),
    thought('r1', '  Checking the result  '),
  ]
  expect(projectFeedRowEntries({ history, live: [] }).activity).toEqual({
    label: 'Checking the result',
    kind: 'thought',
    open: true,
  })
  const next = projectFeedRowEntries({
    history: [...history, message('m2', 'user', 'Next')],
    live: [],
  })
  expect(next.activity).toBeNull()
  expect(next.entries.some((entry) => entry.row.shape === 'activity')).toBe(false)
})

test('reasoning without readable text is neither a row nor an activity', () => {
  const unreadable: FeedContent = { kind: 'reasoning', id: 'r1', text: null, redacted: true }
  const { entries, activity } = projectFeedRowEntries({
    history: [message('m1', 'user', 'Hi'), unreadable, { ...unreadable, id: 'r2' }],
    live: [],
  })
  expect(entries.map((entry) => entry.row.id)).toEqual(['m1'])
  expect(activity).toBeNull()
})

test('unsupported input is skipped and counted, never drawn', () => {
  const { entries, rejected } = projectFeedRowEntries({
    history: [message('m1', 'user', 'Hi'), { kind: 'hologram', id: 'h1' }, 'nonsense'],
    live: [{ type: 'teleport', sequence: 1 }],
  })
  expect(entries.map((entry) => entry.row.id)).toEqual(['m1'])
  expect(rejected).toEqual({ history: 2, live: 1, rows: 0 })
})

test('the sample covers every content kind', () => {
  expect(new Set(durableKinds.map((content) => content.kind))).toEqual(
    new Set(feedContentKindSchema.options),
  )
})

test('the entries draw the rows the renderer drew before', () => {
  const history = durableKinds.slice(0, 9)
  const liveEvents = [
    live(1, message('m9', 'assistant', 'Later')),
    live(2, durableKinds[9] as FeedContent),
  ]
  const { entries } = projectFeedRowEntries({ history, live: liveEvents })
  expect(entries.flatMap((entry) => (entry.row.shape === 'activity' ? [] : [entry.row]))).toEqual(
    foldSettledToolRuns(groupToolRuns(projectLiveFeedRows(history, liveEvents))),
  )
})

test('live rows follow the history rows they extend, in sequence order', () => {
  const { entries } = projectFeedRowEntries({
    history: [message('m1', 'user', 'Hi')],
    live: [live(3, message('m4', 'assistant', 'C')), live(2, message('m3', 'assistant', 'B'))],
  })
  expect(entries.map((entry) => entry.row.id)).toEqual(['m1', 'm3', 'm4'])
})

test('a generated output row keeps the row when its call id fills the identifier cap', () => {
  const callId = 'c'.repeat(256)
  const tool: FeedContent = {
    kind: 'tool',
    id: 't1',
    callId,
    name: 'Read',
    status: 'completed',
    input: null,
    output: [{ kind: 'json', value: { ok: true } }],
    summary: null,
  }
  const { entries, rejected } = projectFeedRowEntries({ history: [tool], live: [] })
  expect(rejected.rows).toBe(0)
  expect(entries.map((entry) => entry.row.shape)).toEqual(['tool-group', 'source', 'activity'])
})

// Successive inputs of one streaming Turn over a settled history, as the reader passes them.
function streamingInputs() {
  const history: unknown[] = [
    message('m1', 'user', 'Hi'),
    tool('c1', 'completed'),
    message('m2', 'assistant', 'Done'),
    message('m3', 'user', 'Again'),
    thought('r1', 'Looking'),
    tool('c2', 'running'),
  ]
  const settled = [live(1, tool('c2', 'completed')), live(2, tool('c3', 'completed'))]
  const turn = [
    [live(1, tool('c2', 'completed'))],
    [live(1, tool('c2', 'completed')), live(2, tool('c3', 'running'))],
    [...settled, live(3, message('m4', 'assistant', 'Stream'))],
    [
      ...settled,
      live(3, message('m4', 'assistant', 'Streamed reply')),
      live(4, message('m2', 'assistant', 'Done, revised')),
    ],
  ]
  return [
    { history, live: [] },
    ...turn.map((events) => ({ history, live: events })),
    { history: [...history, 'nonsense', message('m5', 'user', 'Next')], live: turn[3] ?? [] },
  ]
}

test('a reused projector reads each input as a fresh projection does', () => {
  const projector = new FeedRowProjector()
  for (const input of streamingInputs())
    expect(projector.project(input)).toEqual(projectFeedRowEntries(input))
})

test('a reused projector draws what grouping the whole row list draws', () => {
  const projector = new FeedRowProjector()
  for (const input of streamingInputs()) {
    const history = input.history.filter((item): item is FeedContent => typeof item === 'object')
    const { entries } = projector.project(input)
    expect(entries.flatMap(({ row }) => (row.shape === 'activity' ? [] : [row]))).toEqual(
      foldSettledToolRuns(groupToolRuns(projectLiveFeedRows(history, input.live))),
    )
  }
})

function command(
  id: string,
  status: 'running' | 'completed' | 'failed',
  fields: { command?: string | null; output?: string | null; stderr?: string | null } = {},
): FeedContent {
  return {
    kind: 'command',
    id,
    command: fields.command === undefined ? 'bun test' : fields.command,
    cwd: null,
    status,
    output: fields.output === undefined ? null : fields.output,
    stderr: fields.stderr === undefined ? null : fields.stderr,
    exitCode: status === 'completed' ? 0 : null,
  }
}

function presentedTool(
  callId: string,
  presentation: NonNullable<Extract<FeedContent, { kind: 'tool' }>['presentation']>,
  fields: { status?: 'running' | 'completed' | 'failed'; output?: string } = {},
): FeedContent {
  return {
    kind: 'tool',
    id: callId,
    callId,
    name: presentation.kind,
    status: fields.status ?? 'completed',
    input: null,
    output: fields.output === undefined ? null : [{ kind: 'text', text: fields.output }],
    summary: null,
    presentation,
  }
}

function groups(entries: ReturnType<typeof projectFeedRowEntries>['entries']) {
  return entries.flatMap(({ row }) => (row.shape === 'tool-group' ? [row] : []))
}

test('a running command is one open call, with its text and no evidence', () => {
  const { entries } = projectFeedRowEntries({
    history: [message('m1', 'user', 'Hi'), command('c1', 'running')],
    live: [],
  })
  expect(groups(entries)).toMatchObject([
    {
      label: 'Ran a command',
      calls: [
        {
          id: 'c1',
          kind: 'command',
          label: 'Ran bun test',
          status: 'running',
          evidence: null,
          text: 'bun test',
        },
      ],
    },
  ])
})

test('a finished command keeps stdout and stderr as its evidence', () => {
  const { entries } = projectFeedRowEntries({
    history: [command('c1', 'completed', { command: 'bun test', output: 'ok\n', stderr: 'warn' })],
    live: [],
  })
  expect(groups(entries)[0]).toMatchObject({
    calls: [
      {
        status: 'succeeded',
        evidence: { kind: 'output', title: 'Ran bun test', source: 'ok\n\nwarn' },
      },
    ],
  })
})

test('a failed command keeps its output and reads as failed', () => {
  const { entries } = projectFeedRowEntries({
    history: [command('c1', 'failed', { output: 'boom\n' })],
    live: [],
  })
  expect(groups(entries)[0]).toMatchObject({
    calls: [{ status: 'failed', evidence: { source: 'boom\n' } }],
  })
})

test('a search tool appends the harness failure line to its label', () => {
  const { entries } = projectFeedRowEntries({
    history: [
      presentedTool(
        'w',
        { kind: 'searched', label: 'Searched argo cockpit' },
        { output: 'Internal Error ()\nL0: Failed' },
      ),
    ],
    live: [],
  })
  expect(groups(entries)[0]).toMatchObject({
    label: 'Ran a command',
    calls: [
      {
        kind: 'searched',
        status: 'succeeded',
        label: 'Searched argo cockpit · Internal Error',
        evidence: {
          kind: 'output',
          title: 'Searched argo cockpit',
          source: 'Internal Error ()\nL0: Failed',
        },
      },
    ],
  })
})

test('an agent-written command label stays on the call', () => {
  const { entries } = projectFeedRowEntries({
    history: [
      presentedTool(
        'c1',
        { kind: 'command', label: 'Checking types', agentDescription: true },
        {
          status: 'running',
        },
      ),
    ],
    live: [],
  })
  expect(groups(entries)[0]).toMatchObject({
    calls: [{ kind: 'command', label: 'Checking types', agentDescription: true, text: null }],
  })
})

test('a skill stays its own row between commands', () => {
  const { entries } = projectFeedRowEntries({
    history: [
      command('c1', 'completed', { command: 'bun test' }),
      presentedTool('s', { kind: 'skill', label: 'Simple english' }),
      command('c2', 'completed', { command: 'bun run typecheck' }),
    ],
    live: [],
  })
  expect(groups(entries)).toMatchObject([
    { label: 'Ran a command', calls: [{ id: 'c1', kind: 'command' }] },
    { label: 'Invoked a skill', calls: [{ id: 's', kind: 'skill', label: 'Simple english' }] },
    { label: 'Ran a command', calls: [{ id: 'c2', kind: 'command' }] },
  ])
})

test('a long tool run keeps its group id inside the Feed row limit', () => {
  const history = Array.from({ length: 12 }, (_, index) =>
    command(`123e4567-e89b-12d3-a456-426614174${String(index).padStart(3, '0')}`, 'completed'),
  )
  const { entries, rejected } = projectFeedRowEntries({ history, live: [] })
  const [group] = groups(entries)
  if (group === undefined) throw new Error('missing group')
  expect(rejected.rows).toBe(0)
  expect(group).toMatchObject({ calls: history.map((item) => ({ id: item.id })) })
  expect(group.id.length).toBeLessThanOrEqual(256)
})

test('a reused projector keeps the entries of settled history rows no live event touches', () => {
  const projector = new FeedRowProjector()
  const [first, second] = streamingInputs()
  if (first === undefined || second === undefined) throw new Error('missing inputs')
  const before = projector.project(first).entries
  const after = projector.project(second).entries
  expect(after[0]).toBe(before[0] as (typeof before)[number])
  expect(after[1]).toBe(before[1] as (typeof before)[number])
})

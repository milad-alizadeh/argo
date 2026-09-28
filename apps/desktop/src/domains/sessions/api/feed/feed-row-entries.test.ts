import { expect, test } from 'bun:test'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { feedContentKindSchema } from '@/domains/sessions/api/feed-content'
import type { SessionLiveEvent } from '@/domains/sessions/api/session-live-event'
import { projectFeedRowEntries } from './feed-row-entries'
import { projectLiveFeedRows } from './live-feed-rows'

const sessionId = '00000000-0000-4000-8000-000000000001'
const running = { label: 'Reading the code', kind: 'thought', open: true } as const

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
    activity: null,
  })
  expect(rejected).toEqual({ history: 0, live: 0, rows: 0 })
  expect(entries.map((entry) => entry.row.id)).toEqual(
    durableKinds
      .filter((content) => content.kind !== 'notification' || content.category !== 'status')
      .flatMap((content) => stableId(content)),
  )
  expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length)
})

test('a prompt attachment draws as a user image row', () => {
  const { entries } = projectFeedRowEntries({ history: [attachment], live: [], activity: null })
  expect(entries[0]?.row).toMatchObject({ shape: 'image', role: 'user' })
})

test('ids and revisions are stable across projections of the same input', () => {
  const input = {
    history: [message('m1', 'user', 'Hi'), message('m2', 'assistant', 'Yo')],
    live: [],
    activity: null,
  }
  expect(projectFeedRowEntries(input).entries).toEqual(projectFeedRowEntries(input).entries)
})

test('a changed row keeps its id and changes its revision', () => {
  const project = (text: string) =>
    projectFeedRowEntries({ history: [message('m1', 'assistant', text)], live: [], activity: null })
      .entries[0]
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
    activity: null,
  })
  expect(entries.map((entry) => entry.row.id)).toEqual(['m1', 'm2', 'm3'])
})

test('one transient activity row ends the rows', () => {
  const { entries } = projectFeedRowEntries({
    history: [message('m1', 'user', 'Hi')],
    live: [],
    activity: running,
  })
  expect(entries.at(-1)).toMatchObject({
    id: 'activity',
    row: { shape: 'activity', activity: running },
  })
  expect(entries.filter((entry) => entry.row.shape === 'activity')).toHaveLength(1)
})

test('unsupported input is skipped and counted, never drawn', () => {
  const { entries, rejected } = projectFeedRowEntries({
    history: [message('m1', 'user', 'Hi'), { kind: 'hologram', id: 'h1' }, 'nonsense'],
    live: [{ type: 'teleport', sequence: 1 }],
    activity: null,
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
  const { entries } = projectFeedRowEntries({ history, live: liveEvents, activity: null })
  expect(entries.map((entry) => entry.row)).toEqual(projectLiveFeedRows(history, liveEvents))
})

test('live rows follow the history rows they extend, in sequence order', () => {
  const { entries } = projectFeedRowEntries({
    history: [message('m1', 'user', 'Hi')],
    live: [live(3, message('m4', 'assistant', 'C')), live(2, message('m3', 'assistant', 'B'))],
    activity: null,
  })
  expect(entries.map((entry) => entry.row.id)).toEqual(['m1', 'm3', 'm4'])
})

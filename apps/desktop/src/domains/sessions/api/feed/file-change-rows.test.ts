import { expect, test } from 'bun:test'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionLiveEvent } from '@/domains/sessions/api/session-live-event'
import { projectLiveFeedRows } from './live-feed-rows'

const live = (sequence: number, value: FeedContent): SessionLiveEvent => ({
  type: 'content',
  sessionId: '00000000-0000-4000-8000-000000000002',
  sequence,
  commandId: null,
  turnId: null,
  vendorEventId: value.id,
  content: value,
})

test('names a moved file by both names and shows its diff at the new path', () => {
  const rows = projectLiveFeedRows(
    [
      {
        kind: 'fileChange',
        id: 'patch-move',
        status: 'completed',
        changes: [
          {
            path: '/repo/old.ts',
            change: 'update',
            diff: '@@ -1 +1 @@\n-a\n+b',
            movedTo: '/repo/lib/new.ts',
          },
        ],
      },
    ],
    [],
  )
  expect(rows).toMatchObject([
    {
      kind: 'edited',
      label: 'Moved old.ts to new.ts',
      lineCounts: { added: 1, removed: 1 },
      evidence: { source: ['Update File: /repo/lib/new.ts', '@@ -1 +1 @@', '-a', '+b'].join('\n') },
    },
  ])
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
  expect(rows).toMatchObject([
    {
      shape: 'tool',
      id: 'patch-1',
      kind: 'created',
      label: 'Created new.ts',
      lineCounts: { added: 3, removed: 0 },
      evidence: {
        kind: 'diff',
        source: ['Add File: /repo/new.ts', '@@ -0,0 +1,3 @@', '+first', '+', '+last'].join('\n'),
      },
    },
    {
      kind: 'deleted',
      label: 'Deleted old.ts',
      lineCounts: { added: 0, removed: 1 },
      evidence: { source: ['Delete File: /repo/old.ts', '@@ -1,1 +0,0 @@', '-goodbye'].join('\n') },
    },
    {
      kind: 'edited',
      label: 'Edited changed.ts',
      lineCounts: { added: 1, removed: 1 },
      evidence: {
        source: ['Update File: /repo/changed.ts', '@@ -1 +1 @@', '-old', '+new'].join('\n'),
      },
    },
  ])
  expect(new Set(rows.map((row) => row.id)).size).toBe(3)
})

test('names a live edit by its file and action when the Harness sends no diff', () => {
  const edit: FeedContent = {
    kind: 'fileChange',
    id: 'patch-2',
    status: 'running',
    changes: [{ path: '/repo/feed.ts', change: 'update', diff: null }],
  }
  expect(projectLiveFeedRows([], [live(1, edit)])).toMatchObject([
    {
      shape: 'tool',
      kind: 'edited',
      label: 'Edited feed.ts',
      lineCounts: null,
      status: 'running',
      evidence: { kind: 'diff', source: 'Update File: /repo/feed.ts\n' },
    },
  ])
})

test('a history refresh keeps each edit of a live patch once, settled', () => {
  const changes = [
    { path: '/repo/a.ts', change: 'update' as const, diff: '@@ -1 +1 @@\n-a\n+b' },
    { path: '/repo/b.ts', change: 'add' as const, diff: 'b\n' },
  ]
  const started: FeedContent = { kind: 'fileChange', id: 'patch-3', status: 'running', changes }
  const done: FeedContent = { ...started, status: 'completed' }
  const rows = projectLiveFeedRows([done], [live(1, started), live(2, done)])
  expect(rows.flatMap((row) => (row.shape === 'tool' ? [[row.id, row.status]] : []))).toEqual([
    ['patch-3', 'succeeded'],
    ['patch-3#1', 'succeeded'],
  ])
})

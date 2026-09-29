import { expect, test } from 'bun:test'
import type { SessionFeedRow } from './feed-rows'
import { groupToolRuns } from './tool-groups'

function tool(
  id: string,
  kind: Extract<SessionFeedRow, { shape: 'tool' }>['kind'],
  file?: string,
): SessionFeedRow {
  return {
    shape: 'tool',
    id,
    kind,
    ...(file === undefined ? {} : { file }),
    label: id,
    lineCounts: null,
    status: 'succeeded',
    evidence: null,
    text: null,
  }
}

test('groups mixed calls across commentary and keeps the latest commentary', () => {
  const rows: SessionFeedRow[] = [
    tool('command-1', 'command'),
    { shape: 'thought', id: 'commentary-1', text: 'Reading the output' },
    tool('edit-1', 'edited'),
    tool('command-2', 'command'),
    { shape: 'thought', id: 'commentary-2', text: 'Checking the result' },
    { shape: 'prose', id: 'answer', role: 'assistant', text: 'Done' },
  ]

  expect(groupToolRuns(rows)).toMatchObject([
    {
      shape: 'tool-group',
      label: 'Ran 2 commands, edited a file',
      calls: [{ id: 'command-1' }, { id: 'edit-1' }, { id: 'command-2' }],
      thoughts: [
        { id: 'commentary-1', text: 'Reading the output', afterCallIndex: 0 },
        { id: 'commentary-2', text: 'Checking the result', afterCallIndex: 2 },
      ],
    },
    { shape: 'prose', id: 'answer' },
  ])
})

test('a hidden turn boundary starts another disclosure even after commentary', () => {
  const rows: SessionFeedRow[] = [
    tool('command-1', 'command'),
    { shape: 'thought', id: 'commentary-1', text: 'First turn' },
    tool('command-2', 'command'),
  ]
  expect(groupToolRuns(rows, new Set(['command-2'])).map((row) => row.shape)).toEqual([
    'tool-group',
    'tool-group',
  ])
})

test('counts a file edited twice as one file', () => {
  const rows: SessionFeedRow[] = [
    tool('edit-1', 'edited', '/repo/a.ts'),
    tool('edit-2', 'edited', '/repo/a.ts'),
    tool('edit-3', 'edited', '/repo/b.ts'),
  ]
  expect(groupToolRuns(rows)).toMatchObject([{ label: 'Edited 2 files' }])
})

test('orders group phrases by the first call of each kind and counts every file', () => {
  const rows: SessionFeedRow[] = [
    tool('edit-1', 'edited'),
    tool('edit-2', 'edited'),
    tool('command-1', 'command'),
    tool('create-1', 'created'),
  ]
  expect(groupToolRuns(rows)).toMatchObject([
    {
      label: 'Edited 2 files, ran a command, created a file',
      calls: [{ id: 'edit-1' }, { id: 'edit-2' }, { id: 'command-1' }, { id: 'create-1' }],
    },
  ])
})

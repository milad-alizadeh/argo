import { expect, test } from 'bun:test'
import type { SessionFeedRow } from '../../model/models'
import { groupToolRuns } from './tool-groups'

function tool(
  id: string,
  kind: Extract<SessionFeedRow, { shape: 'tool' }>['kind'],
): SessionFeedRow {
  return {
    shape: 'tool',
    id,
    kind,
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

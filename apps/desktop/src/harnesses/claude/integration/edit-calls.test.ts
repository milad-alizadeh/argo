import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import { fed, feedRequest, rowsOf } from '@/domains/sessions/main/observation/reader-test-helpers'
import { fixtureRoot } from '@/harnesses/claude/integration/session-fixtures'
import { claudeSessionSource } from '@/harnesses/claude/sessions/read-sessions'

test('a written and an edited file arrive as edits with their diffs before any result', async (context) => {
  const root = await fixtureRoot(context, ['parityEdit'])
  const reader = createSessionReader([claudeSessionSource({ transcripts: root })])
  const rows = rowsOf(await fed(reader, feedRequest('parityEdit')))
  const calls = rows.flatMap((row) => (row.shape === 'tool-group' ? row.calls : []))
  assert.deepEqual(
    calls.map(({ kind, label, lineCounts }) => ({ kind, label, lineCounts })),
    [
      { kind: 'created', label: 'Created notes.md', lineCounts: { added: 2, removed: 0 } },
      { kind: 'edited', label: 'Edited app.ts', lineCounts: { added: 2, removed: 1 } },
      { kind: 'edited', label: 'Edited util.ts', lineCounts: { added: 1, removed: 1 } },
    ],
  )
  assert.equal(calls[0]?.evidence?.kind, 'diff')
})

test('a notebook cell change arrives as an update of the notebook', async (context) => {
  const root = await fixtureRoot(context, ['notebookEdit'])
  const reader = createSessionReader([claudeSessionSource({ transcripts: root })])
  const rows = rowsOf(await fed(reader, feedRequest('notebookEdit')))
  const calls = rows.flatMap((row) => (row.shape === 'tool-group' ? row.calls : []))
  assert.deepEqual(
    calls.map(({ kind, label }) => ({ kind, label })),
    [{ kind: 'edited', label: 'Edited analysis.ipynb' }],
  )
})

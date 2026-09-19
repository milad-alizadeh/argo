import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSessionReader } from '../../../domains/sessions/main/reader'
import { fed, feedRequest, rowsOf } from '../../../domains/sessions/main/reader-test-helpers'
import { toolCallsOf } from '../../../domains/sessions/main/tool-calls-of'
import { claudeSessionSource } from '../sessions/read-sessions'
import { fixtureRoot } from './session-fixtures'

test('shows the pattern of a file search for Glob and Grep', async (context) => {
  const root = await fixtureRoot(context, ['fileSearch'])
  const reader = createSessionReader([claudeSessionSource({ transcripts: root })])
  const rows = rowsOf(await fed(reader, feedRequest('fileSearch')))
  assert.deepEqual(toolCallsOf(rows), [
    { kind: 'searched', status: 'succeeded', label: 'Searched **/*.test.ts', text: '**/*.test.ts' },
    { kind: 'searched', status: 'succeeded', label: 'Searched TODO', text: 'TODO' },
  ])
})

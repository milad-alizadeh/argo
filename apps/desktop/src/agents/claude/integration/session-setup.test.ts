import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stitchChains } from '../../../domains/sessions/contract/chains.ts'
import { projectRosterRow } from '../../../domains/sessions/main/roster.ts'
import { fixtureFile } from './session-fixtures'

test("reads the newest Turn's Model and Effort off its reply and its Mode off its prompt", async () => {
  const file = await fixtureFile('turnSetup')
  const answered = { ...file, records: file.records.slice(0, 5) }
  assert.deepEqual(projectRosterRow(stitchChains([answered])[0]).setup, {
    model: 'claude-sonnet-5',
    effort: 'medium',
    mode: 'plan',
  })
})

test('reads no Model or Effort for a Turn Claude has not answered yet', async () => {
  assert.deepEqual(projectRosterRow(stitchChains([await fixtureFile('turnSetup')])[0]).setup, {
    model: null,
    effort: null,
    mode: 'bypassPermissions',
  })
})

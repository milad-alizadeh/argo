import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rosterRow } from '@/domains/sessions/contract/observation/roster-row-test-fixture'
import { storedRosterRow } from './stored-row'

test('loads a stored Session row that predates the harness name', () => {
  const row = rosterRow()
  const { harness, ...beforeRename } = row

  assert.deepEqual(storedRosterRow(JSON.stringify({ ...beforeRename, cli: harness })), row)
})

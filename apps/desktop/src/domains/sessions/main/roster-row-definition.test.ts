import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sessionRosterRowSchema } from '@/domains/sessions/contract/models'
import { rosterRowFields } from '@/domains/sessions/contract/roster-row-definition'

test('declares every Roster row field exactly once', () => {
  const names = rosterRowFields.map(({ name }) => name)

  assert.equal(new Set(names).size, names.length)
  assert.deepEqual(Object.keys(sessionRosterRowSchema.shape), names)
})

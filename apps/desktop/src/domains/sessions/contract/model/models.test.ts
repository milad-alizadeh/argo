import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rosterRow } from '../observation/roster-row-test-fixture'
import { sessionFeedRowSchema, sessionRosterRowSchema } from './index'

const roster = rosterRow()

test('accepts only complete Roster rows', () => {
  for (const [value, accepted] of [
    [roster, true],
    [{ ...roster, status: 'waiting' }, false],
    [{ ...roster, archived: 'false' }, false],
    [{ ...roster, extra: true }, false],
  ] as const) {
    assert.equal(sessionRosterRowSchema.safeParse(value).success, accepted)
  }
})

test('accepts only known Feed row shapes', () => {
  for (const [value, accepted] of [
    [{ shape: 'prose', id: 'row-one', role: 'assistant', text: 'Hello' }, true],
    [{ shape: 'marker', id: 'row-one', marker: 'compacted', summary: null }, true],
    [{ shape: 'event', id: 'row-one', event: 'status', text: 'running' }, true],
    [{ shape: 'event', id: 'row-one', event: 'unknown', text: null }, false],
    [{ shape: 'marker', id: 'row-one', marker: 'other', summary: null }, false],
    [{ shape: 'prose', id: 'row-one', role: 'tool', text: 'Hello' }, false],
  ] as const) {
    assert.equal(sessionFeedRowSchema.safeParse(value).success, accepted)
  }
})

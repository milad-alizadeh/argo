import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sessionFeedRowSchema, sessionRosterRowSchema } from './models'

const roster = {
  id: 'session-one',
  retiredIds: [],
  cli: 'claude',
  posture: 'managed',
  title: null,
  status: 'idle',
  entry: 'interactive',
  cwd: null,
  branch: null,
  updatedAt: null,
  unreadableLines: 0,
  originUnread: false,
  turnStartedAt: null,
  activity: null,
  plan: null,
  delegations: [],
  shell: [],
  pullRequest: null,
  archived: false,
}

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
    [{ shape: 'marker', id: 'row-one', marker: 'compacted' }, true],
    [{ shape: 'marker', id: 'row-one', marker: 'other' }, false],
    [{ shape: 'prose', id: 'row-one', role: 'tool', text: 'Hello' }, false],
  ] as const) {
    assert.equal(sessionFeedRowSchema.safeParse(value).success, accepted)
  }
})

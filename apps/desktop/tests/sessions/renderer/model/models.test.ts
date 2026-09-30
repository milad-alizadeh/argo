import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sessionFeedRowSchema } from '@/domains/sessions/api/feed/feed-rows'
import { sessionListRowSchema } from '@/domains/sessions/main/api/session-list'
import { sessionRow } from '@/mocks/sessions/session-rows'

const roster = sessionRow({
  id: '0f7c8a3e-5b1d-4c2a-9e64-2d1b7a8c9f10',
  cwd: null,
  posture: 'live',
  status: 'idle',
  title: null,
})

test('accepts only complete Roster rows', () => {
  for (const [value, accepted] of [
    [roster, true],
    [{ ...roster, status: 'waiting' }, false],
    [{ ...roster, archived: 'false' }, false],
    [{ ...roster, extra: true }, false],
  ] as const) {
    assert.equal(sessionListRowSchema.safeParse(value).success, accepted)
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

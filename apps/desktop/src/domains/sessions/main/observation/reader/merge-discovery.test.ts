import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sessionError } from '@/domains/sessions/contract/ipc'
import { combineDiscoveries, type Discovered } from './merge-discovery'

function readingOf(overrides: Partial<Discovered & { rows: [] }> = {}): Discovered {
  return {
    rows: [],
    filesFound: 0,
    filesRead: 0,
    filesUnreadable: 0,
    filesParsed: 0,
    nextCursor: null,
    historyComplete: true,
    ...overrides,
  }
}

test('names the failing source in a reply built from the other, healthy one (#2653 follow-up)', () => {
  const reply = combineDiscoveries(
    [readingOf(), { error: sessionError('vendor-history-unavailable', 'req-1') }],
    ['claude', 'codex'],
    'req-1',
  )

  assert.equal(reply.type, 'session.listed')
  assert.deepEqual(reply.type === 'session.listed' ? reply.partialFailures : null, [
    { harness: 'codex', code: 'vendor-history-unavailable' },
  ])
})

test('carries no partial failure when every source answers', () => {
  const reply = combineDiscoveries([readingOf(), readingOf()], ['claude', 'codex'], 'req-1')

  assert.equal(reply.type, 'session.listed')
  assert.deepEqual(reply.type === 'session.listed' ? reply.partialFailures : null, [])
})

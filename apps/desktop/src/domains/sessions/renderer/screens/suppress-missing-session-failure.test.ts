import { expect, test } from 'bun:test'
import { suppressMissingSessionFailure } from './suppress-missing-session-failure'

const missingSessionFailure = { code: 'missing-session' as const }

test('suppresses a missing-Session composer banner when that Session Feed has stalled', () => {
  expect(
    suppressMissingSessionFailure({
      failure: missingSessionFailure,
      feedError: null,
      feedStalledSessionId: 'session-one',
      selectedSessionId: 'session-one',
    }),
  ).toBe(true)
})

test('suppresses a missing-Session composer banner when that Session Feed has failed', () => {
  expect(
    suppressMissingSessionFailure({
      failure: missingSessionFailure,
      feedError: { requestId: 'session-one' },
      feedStalledSessionId: null,
      selectedSessionId: 'session-one',
    }),
  ).toBe(true)
})

test('keeps a missing-Session composer banner when the Feed problem belongs to another Session', () => {
  expect(
    suppressMissingSessionFailure({
      failure: missingSessionFailure,
      feedError: { requestId: 'session-two' },
      feedStalledSessionId: null,
      selectedSessionId: 'session-one',
    }),
  ).toBe(false)
})

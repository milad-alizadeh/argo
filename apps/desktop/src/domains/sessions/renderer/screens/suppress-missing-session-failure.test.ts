import { expect, test } from 'bun:test'
import { suppressMissingSessionFailure } from './suppress-missing-session-failure'

const missingSessionFailure = { code: 'missing-session' as const }

test('suppresses a missing-Session composer banner when that Session Feed has stalled', () => {
  expect(
    suppressMissingSessionFailure({
      failure: missingSessionFailure,
      feedFailureSessionId: null,
      feedStalledSessionId: 'session-one',
      selectedSessionId: 'session-one',
    }),
  ).toBe(true)
})

test('suppresses a missing-Session composer banner when that Session Feed has failed', () => {
  expect(
    suppressMissingSessionFailure({
      failure: missingSessionFailure,
      feedFailureSessionId: 'session-one',
      feedStalledSessionId: null,
      selectedSessionId: 'session-one',
    }),
  ).toBe(true)
})

test('keeps a missing-Session composer banner when a different Session Feed stalled', () => {
  expect(
    suppressMissingSessionFailure({
      failure: missingSessionFailure,
      feedFailureSessionId: null,
      feedStalledSessionId: 'session-two',
      selectedSessionId: 'session-one',
    }),
  ).toBe(false)
})

test('keeps a missing-Session composer banner when a different Session Feed failed', () => {
  expect(
    suppressMissingSessionFailure({
      failure: missingSessionFailure,
      feedFailureSessionId: 'session-two',
      feedStalledSessionId: null,
      selectedSessionId: 'session-one',
    }),
  ).toBe(false)
})

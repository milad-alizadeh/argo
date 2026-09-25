import { expect, test } from 'bun:test'

import { driveSessionError } from '@/domains/sessions/api/session-error'
import { sessionFailureState } from './session-failure-state'

test('reads a Session held elsewhere as unavailable rather than an error, for both CLIs', () => {
  expect(sessionFailureState(driveSessionError('held-elsewhere', 'claude', null).code)).toBe(
    'unavailable',
  )
  expect(sessionFailureState(driveSessionError('held-elsewhere', 'codex', null).code)).toBe(
    'unavailable',
  )
})

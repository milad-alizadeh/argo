import { expect, test } from 'bun:test'

import { sessionError } from '@/core/sessions/contract'
import { sessionFailureState } from './sessionFailureState'

test('reads a Session held elsewhere as unavailable rather than an error, for both CLIs', () => {
  expect(sessionFailureState(sessionError('held-elsewhere', null).code)).toBe('unavailable')
  expect(sessionFailureState(sessionError('codex-held-elsewhere', null).code)).toBe('unavailable')
})

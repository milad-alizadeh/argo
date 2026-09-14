import assert from 'node:assert/strict'
import { test } from 'node:test'

import { sessionError } from '@/core/sessions/contract'
import { sessionFailureState } from './sessionFailureState'

test('reads a Session held elsewhere as unavailable rather than an error, for both CLIs', () => {
  assert.equal(sessionFailureState(sessionError('held-elsewhere', null).code), 'unavailable')
  assert.equal(sessionFailureState(sessionError('codex-held-elsewhere', null).code), 'unavailable')
})

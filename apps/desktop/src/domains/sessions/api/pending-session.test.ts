import { expect, test } from 'bun:test'
import { pendingSessionDraft, pendingSessionId } from './pending-session'

test('a pending Session id names the draft revision that started it', () => {
  const sessionId = pendingSessionId({ id: 'draft-1', revision: 3 })
  expect(pendingSessionDraft(sessionId)).toEqual({ draftId: 'draft-1', revision: 3 })
})

test('a named Session id is not pending', () => {
  for (const sessionId of [
    '00000000-0000-4000-8000-000000000001',
    'optimistic:draft-1',
    'optimistic::3',
  ])
    expect(pendingSessionDraft(sessionId)).toBeNull()
})

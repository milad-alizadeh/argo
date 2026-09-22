import { expect, test } from 'bun:test'
import { isManagedSessionSelected } from './use-composer-actions'

test('allows compacting a managed Session', () => {
  expect(isManagedSessionSelected({ kind: 'session', sessionId: 'session-1' }, 'managed')).toBe(
    true,
  )
})

test('does not allow compacting an external Session', () => {
  expect(isManagedSessionSelected({ kind: 'session', sessionId: 'session-1' }, 'external')).toBe(
    false,
  )
})

test('does not allow compacting a pending Session', () => {
  expect(
    isManagedSessionSelected(
      { kind: 'pending', sessionId: 'optimistic:1', projectId: 'project-1' },
      'managed',
    ),
  ).toBe(false)
})

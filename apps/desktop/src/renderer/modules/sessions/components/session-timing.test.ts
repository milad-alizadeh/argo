import { expect, test } from 'bun:test'

import { sessionRosterRow } from '../session-fixtures'
import { sessionTiming } from './session-timing'

const NOW = Date.parse('2026-09-14T12:00:00.000Z')

test('shows the current Turn duration for a running Session', () => {
  const session = sessionRosterRow({
    id: 'running',
    posture: 'managed',
    title: null,
    status: 'running',
    cwd: '/workspace/argo',
    turnStartedAt: '2026-09-14T10:43:00.000Z',
  })

  expect(sessionTiming(session, NOW)?.text).toBe('Running 1h 17m')
})

test('shows recency instead of accumulated lifetime for an idle Session', () => {
  const session = sessionRosterRow({
    id: 'idle',
    posture: 'managed',
    title: null,
    status: 'idle',
    cwd: '/workspace/argo',
    updatedAt: '2026-09-14T11:52:00.000Z',
  })

  expect(sessionTiming(session, NOW)?.text).toBe('Updated 8m ago')
})

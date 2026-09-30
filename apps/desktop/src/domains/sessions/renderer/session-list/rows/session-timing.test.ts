import { expect, test } from 'bun:test'
import { sessionRow } from '@/mocks/sessions/session-rows'
import { sessionTiming } from './session-timing'

const NOW = Date.parse('2026-09-14T12:00:00.000Z')

test('shows recency instead of accumulated lifetime for an idle Session', () => {
  const session = sessionRow({
    id: 'idle',
    posture: 'live',
    title: null,
    status: 'idle',
    cwd: '/workspace/argo',
    updatedAt: '2026-09-14T11:52:00.000Z',
  })

  expect(sessionTiming(session, NOW)).toMatchObject({ minutes: 8, text: '8m' })
})

import { expect, test } from 'bun:test'
import { canRestoreInterruptedMarker } from '@/domains/sessions/renderer/composer/use-composer-marker'

const entry = {
  files: [],
  images: [],
  prompt: 'Continue.',
  since: '2026-09-21T02:00:00.000Z',
  stage: 'live' as const,
  startedAt: 1,
}

test('restores an interrupted marker only for the same running Turn', () => {
  expect(
    canRestoreInterruptedMarker(entry, undefined, {
      status: 'running',
      turnStartedAt: entry.since,
    }),
  ).toBe(true)
  expect(
    canRestoreInterruptedMarker(entry, undefined, {
      status: 'running',
      turnStartedAt: '2026-09-21T02:01:00.000Z',
    }),
  ).toBe(false)
  expect(
    canRestoreInterruptedMarker(entry, entry, {
      status: 'running',
      turnStartedAt: entry.since,
    }),
  ).toBe(false)
})

import { expect, test } from 'vitest'
import { indexedSessionFeed } from './indexed-session-feed'

test('keeps an empty selected history distinct from an unselected Feed', () => {
  expect(indexedSessionFeed(null, undefined)).toBeNull()
  expect(
    indexedSessionFeed('00000000-0000-4000-8000-000000000001', {
      result: 'empty',
      harness: 'claude',
      availability: { state: 'available', reason: null },
      live: false,
    })?.rows,
  ).toEqual([])
})

test('maps stable history source IDs to Feed prose rows once', () => {
  expect(
    indexedSessionFeed('00000000-0000-4000-8000-000000000001', {
      result: 'history',
      harness: 'claude',
      availability: { state: 'available', reason: null },
      live: false,
      entries: [
        { sourceId: '00000000-0000-4000-8000-000000000002', role: 'user', text: 'Review.' },
      ],
    })?.rows,
  ).toEqual([
    {
      shape: 'prose',
      id: '00000000-0000-4000-8000-000000000002',
      role: 'user',
      text: 'Review.',
    },
  ])
})

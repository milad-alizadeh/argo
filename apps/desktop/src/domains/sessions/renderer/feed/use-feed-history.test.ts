import { expect, test } from 'vitest'
import type { SessionFeed } from '../types'
import { mergedContent } from './use-feed-history'

function page(ids: string[], revision: string): SessionFeed {
  return {
    version: 1,
    type: 'session.feed.read',
    requestId: revision,
    sessionId: 'session-1',
    chainId: 'session-1',
    revision,
    content: ids.map((id) => ({ kind: 'message', id, role: 'assistant', text: id })),
    rows: [],
  }
}

test('a refreshed newest page replaces overlap without duplicating older rows', () => {
  const older = page(['one', 'two', 'three'], 'older')
  const newest = page(['three', 'four', 'five'], 'newest')
  expect(mergedContent([older], newest).map((item) => item.id)).toEqual([
    'one',
    'two',
    'three',
    'four',
    'five',
  ])
})

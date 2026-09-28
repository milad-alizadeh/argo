import { expect, test } from 'bun:test'
import type { SessionFeedSnapshot } from '../types'
import { displayedFeed } from './use-session-feed'

function snapshot(sessionId: string, chainId: string): SessionFeedSnapshot {
  return {
    version: 1,
    type: 'session.feed.read',
    requestId: `${chainId}-read`,
    sessionId,
    chainId,
    revision: chainId,
    content: [{ kind: 'message', id: `${chainId}-reply`, role: 'assistant', text: chainId }],
  }
}

test('a late snapshot for another Session is not shown', () => {
  expect(
    displayedFeed({
      selectedSessionId: 'session-b',
      subagentId: null,
      reading: snapshot('session-a', 'session-a'),
      live: null,
    }),
  ).toBeNull()
})

test('a late snapshot for another subagent chain of the same Session is not shown', () => {
  expect(
    displayedFeed({
      selectedSessionId: 'session-a',
      subagentId: 'child-2',
      reading: snapshot('session-a', 'child-1'),
      live: null,
    }),
  ).toBeNull()
})

test('the selected chain snapshot is shown as rows', () => {
  const feed = displayedFeed({
    selectedSessionId: 'session-a',
    subagentId: 'child-1',
    reading: snapshot('session-a', 'child-1'),
    live: null,
  })
  expect(feed?.rows.map((row) => row.id)).toEqual(['child-1-reply'])
})

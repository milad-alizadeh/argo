import { expect, test } from 'bun:test'
import type { SessionFeedOutput } from '../../contract/session-history'
import { mergeSessionFeed } from './merge-session-feed'

function feed(rows: SessionFeedOutput['rows'], live: boolean): SessionFeedOutput {
  return {
    version: 1,
    type: 'session.feed.read',
    requestId: 'session-1',
    sessionId: 'session-1',
    chainId: 'session-1',
    revision: JSON.stringify(rows),
    rows,
    harness: 'codex',
    availability: { state: 'available', reason: null },
    live,
    working: live,
  }
}

test('history fills gaps around immediate live entries without duplicating a source', () => {
  const history = feed(
    [
      { shape: 'prose', id: 'old', role: 'user', text: 'Start' },
      { shape: 'prose', id: 'reply', role: 'assistant', text: 'Hel' },
    ],
    false,
  )
  const live = feed(
    [
      { shape: 'prose', id: 'reply', role: 'assistant', text: 'Hello' },
      { shape: 'prose', id: 'next', role: 'assistant', text: 'Next' },
    ],
    true,
  )
  expect(mergeSessionFeed(history, live)?.rows).toEqual([
    { shape: 'prose', id: 'old', role: 'user', text: 'Start' },
    { shape: 'prose', id: 'reply', role: 'assistant', text: 'Hello' },
    { shape: 'prose', id: 'next', role: 'assistant', text: 'Next' },
  ])
})

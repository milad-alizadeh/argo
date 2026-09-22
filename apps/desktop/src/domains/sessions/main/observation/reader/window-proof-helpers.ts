// Shared by both adapters' bounded-window proofs (#2239): a Session outside the initial window
// is unread on first discovery, but reachable once the window grows or the id is asked for
// directly. Each adapter still owns its own fixture; only this assertion shape is common.
import assert from 'node:assert/strict'
import { sessionFeedReplySchema, sessionListReplySchema } from '@/domains/sessions/contract/ipc'
import type { SessionReader } from '../../composition'

const listing = {
  version: 1 as const,
  type: 'session.list' as const,
  requestId: 'list-1',
  projectRoot: null,
}

export async function assertWindowGrowsToFarSession(reader: SessionReader, farId: string) {
  const first = sessionListReplySchema.parse(await reader.listSessions(listing))
  assert.equal(first.type, 'session.listed')
  assert.ok(first.type === 'session.listed' && !first.sessions.some((row) => row.id === farId))
  assert.ok(first.type === 'session.listed' && first.nextCursor !== null)

  const grown = sessionListReplySchema.parse(
    await reader.listSessions({
      ...listing,
      requestId: 'list-2',
      cursor: first.type === 'session.listed' ? first.nextCursor : null,
    }),
  )
  assert.ok(grown.type === 'session.listed' && grown.sessions.some((row) => row.id === farId))
  assert.ok(grown.type === 'session.listed' && grown.nextCursor === null)

  const feed = sessionFeedReplySchema.parse(
    await reader.readSessionFeed({
      version: 1,
      type: 'session.feed',
      requestId: 'feed-1',
      sessionId: farId,
      subagentId: null,
      revision: null,
    }),
  )
  assert.equal(feed.type, 'session.feed.read')
}

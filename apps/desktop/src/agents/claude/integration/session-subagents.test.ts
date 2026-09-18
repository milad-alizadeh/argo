import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSessionReader } from '@/domains/sessions/main/reader.ts'
import { claudeSessionSource } from '../sessions/read-sessions.ts'
import { fixtureRoot } from './session-fixtures'

// The `Task` call in `subagentTail`, and the Subagent transcript its meta file joins to it.
const DELEGATION = 'call-task-1'

function feedRequest(delegationId: string | null) {
  return {
    version: 1 as const,
    type: 'session.feed' as const,
    requestId: 'feed-1',
    sessionId: 'subagentTail',
    delegationId,
    revision: null,
  }
}

async function readFeed(root: string, delegationId: string | null) {
  const reply = await createSessionReader([
    claudeSessionSource({ transcripts: root }),
  ]).readSessionFeed(feedRequest(delegationId))
  assert.equal(reply.type, 'session.feed.read')
  return reply.type === 'session.feed.read' ? reply : null
}

test("reads a Subagent's own transcript as its Feed", async (context) => {
  const root = await fixtureRoot(context, ['subagentTail'])
  const feed = await readFeed(root, DELEGATION)
  const text = JSON.stringify(feed?.rows)
  assert.match(text, /Eleven callers, all in the same package\./)
  assert.match(text, /find the callers/)
  // The Session's own prompt belongs to the Session's Feed, not the Subagent's.
  assert.doesNotMatch(text, /Search the tree for every caller/)
})

test("keeps the Session's own Feed separate from a Subagent's", async (context) => {
  const root = await fixtureRoot(context, ['subagentTail'])
  const main = await readFeed(root, null)
  const text = JSON.stringify(main?.rows)
  assert.match(text, /Search the tree for every caller/)
  // The sidechain the Session records stays out of its own Feed.
  assert.doesNotMatch(text, /Eleven callers, all in the same package\./)
})

test('reads no Feed for a delegation the Session never recorded', async (context) => {
  const root = await fixtureRoot(context, ['subagentTail'])
  const reply = await createSessionReader([
    claudeSessionSource({ transcripts: root }),
  ]).readSessionFeed(feedRequest('no-such-call'))
  assert.equal(reply.type, 'session.error')
})

test('reads what each Subagent spent from its own transcript', async (context) => {
  const root = await fixtureRoot(context, ['subagentTail'])
  const reply = await createSessionReader([
    claudeSessionSource({ transcripts: root }),
  ]).readDelegationUsage({
    version: 1,
    type: 'session.delegation.usage',
    requestId: 'usage-1',
    sessionId: 'subagentTail',
  })
  assert.equal(reply.type, 'session.delegation.usage.read')
  assert.deepEqual(reply.type === 'session.delegation.usage.read' ? reply.usage : null, [
    { id: DELEGATION, tokens: 2700 },
  ])
})

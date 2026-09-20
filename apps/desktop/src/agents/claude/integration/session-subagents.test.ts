import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fixtureRoot } from '@/agents/claude/integration/session-fixtures'
import { claudeSessionSource } from '@/agents/claude/sessions/read-sessions.ts'
import { createSessionReader } from '@/domains/sessions/main/observation/reader.ts'

// The `Task` call in `subagentTail`, and the Subagent transcript its meta file joins to it.
const DELEGATION = 'call-task-1'

function feedRequest(subagentId: string | null) {
  return {
    version: 1 as const,
    type: 'session.feed' as const,
    requestId: 'feed-1',
    sessionId: 'subagentTail',
    subagentId,
    revision: null,
  }
}

async function readFeed(root: string, subagentId: string | null) {
  const reply = await createSessionReader([
    claudeSessionSource({ transcripts: root }),
  ]).readSessionFeed(feedRequest(subagentId))
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
  ]).readSubagentUsage({
    version: 1,
    type: 'session.subagent.usage',
    requestId: 'usage-1',
    sessionId: 'subagentTail',
  })
  assert.equal(reply.type, 'session.subagent.usage.read')
  assert.deepEqual(reply.type === 'session.subagent.usage.read' ? reply.usage : null, [
    { id: DELEGATION, tokens: 2700, model: null },
  ])
})

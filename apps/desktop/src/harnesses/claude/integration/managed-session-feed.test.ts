import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSessionReader } from '@/domains/sessions/main/reader.ts'
import { launch, ledgerFile, OPENING } from '@/harnesses/claude/integration/claude-driver-launch.ts'
import { fixtureRoot } from '@/harnesses/claude/integration/session-fixtures'
import { claudeSessionSource } from '@/harnesses/claude/sessions/read-sessions.ts'

const feed = {
  version: 1,
  type: 'session.feed',
  requestId: 'feed-1',
  subagentId: null,
  revision: null,
}

test('answers an empty Feed for a managed Session whose transcript is not written yet', async (context) => {
  const root = await fixtureRoot(context, ['externalBasic'])
  const { driver } = launch(await ledgerFile(context))
  const sessionId = driver.start({
    cwd: '/projects/argo',
    prompt: 'Inspect the failing test.',
    setup: OPENING,
  })
  const reader = createSessionReader([
    claudeSessionSource({ transcripts: root, managedSessions: driver.roster }),
  ])
  const reply = await reader.readSessionFeed({ ...feed, sessionId })
  assert.equal(reply.type, 'session.feed.read')
  assert.deepEqual({ chainId: reply.chainId, rows: reply.rows }, { chainId: sessionId, rows: [] })
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSessionReader } from '@/domains/sessions/main/observation/reader/reader'
import { claudeSessionSource } from '../sessions/discovery/read-sessions'
import { launch, ledgerFile, OPENING } from './claude-driver-launch'
import { fixtureRoot } from './session-fixtures'

const feed = {
  version: 1,
  type: 'session.feed',
  requestId: 'feed-1',
  subagentId: null,
  revision: null,
}

test('answers an empty Feed for a managed Session whose transcript is not written yet', async (context) => {
  const root = await fixtureRoot(context, ['11111111-2222-4333-8444-555555555555'])
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

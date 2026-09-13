import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClaudeSessionDriver } from '../drive/claude-session-driver.ts'
import { createClaudeSessionReader } from '../sessions/read-sessions.ts'
import { fixtureRoot } from './session-fixtures'

const feed = {
  version: 1,
  type: 'session.feed',
  requestId: 'feed-1',
  revision: null,
}

test('answers an empty Feed for a managed Session whose transcript is not written yet', async (context) => {
  const root = await fixtureRoot(context, ['externalBasic'])
  const driver = createClaudeSessionDriver({
    findExecutable: () => '/usr/local/bin/claude',
    mintSessionId: () => 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c',
    now: () => new Date('2026-09-13T15:17:11.000Z'),
    schedule: () => {},
    spawn: () => ({ write: () => {}, onData: () => {} }),
  })
  const sessionId = driver.start({ cwd: '/projects/argo', prompt: 'Inspect the failing test.' })
  const reader = createClaudeSessionReader({ transcripts: root, managedSessions: driver.roster })
  const reply = await reader.readSessionFeed({ ...feed, sessionId })
  assert.equal(reply.type, 'session.feed.read')
  assert.deepEqual({ chainId: reply.chainId, rows: reply.rows }, { chainId: sessionId, rows: [] })
})

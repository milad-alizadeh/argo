import assert from 'node:assert/strict'
import { CLAUDE_FEED_REQUEST, CODEX_FEED_REQUEST } from './session-proof-requests'

export async function proveContract(page) {
  const list = await page.evaluate(() => window.argo.listSessions())
  assert.equal(list.type, 'session.listed')
  assert.deepEqual({ found: list.filesFound, read: list.filesRead }, { found: 13, read: 13 })
  assert.deepEqual(list.sessions.map((session) => session.id).sort(), [
    'askPending',
    'externalBasic',
    'harnessNoise',
    'plannedWork',
    'prose',
    'resumeParent',
    'rollout-codexParent',
    'setupAnswered',
    'strandedResume',
    'toolCalls',
  ])
  assert.deepEqual(
    list.sessions.filter((session) => session.archived).map((session) => session.id),
    ['plannedWork'],
  )
  assert.deepEqual(
    list.sessions.filter((session) => session.originUnread).map((session) => session.id),
    ['strandedResume'],
  )
  assert.deepEqual([...new Set(list.sessions.map((session) => session.posture))], ['external'])
  const read = await page.evaluate(
    (value) => window.argo.readSessionFeed(value),
    CLAUDE_FEED_REQUEST,
  )
  assert.equal(read.chainId, 'resumeParent')
  assert.equal(read.rows.length, 4)
  const codexRead = await page.evaluate(
    (value) => window.argo.readSessionFeed(value),
    CODEX_FEED_REQUEST,
  )
  assert.equal(codexRead.chainId, 'rollout-codexParent')
  assert.equal(codexRead.rows.length, 4)
  const missing = await page.evaluate((value) => window.argo.readSessionFeed(value), {
    ...CLAUDE_FEED_REQUEST,
    sessionId: 'not-a-session',
  })
  assert.equal(missing.code, 'missing-session')
}

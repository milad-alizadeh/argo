import assert from 'node:assert/strict'
import { CLAUDE_FEED_REQUEST, CODEX_FEED_REQUEST } from './session-proof-requests'

// The archived Sessions answer their own read, one page of them, and never the active list.
async function proveArchivedPage(page) {
  const archived = await page.evaluate(() =>
    window.argo.listArchivedSessions({ cursor: null, restoreId: null }),
  )
  assert.equal(archived.type, 'session.archive.listed')
  assert.deepEqual(
    archived.sessions.map((session) => session.id),
    ['plannedWork'],
  )
  assert.equal(archived.sessions[0].archived, true)
  assert.equal(archived.nextCursor, null)
  assert.equal(archived.restored, null)
}

export async function proveContract(page) {
  const list = await page.evaluate(() => window.argo.listSessions())
  assert.equal(list.type, 'session.listed')
  assert.deepEqual({ found: list.filesFound, read: list.filesRead }, { found: 15, read: 15 })
  // Discovery still reads every transcript file (`filesRead` above), but an archived Session
  // never projects into this active list (#1593): `plannedWork` is read out of it below instead.
  assert.deepEqual(list.sessions.map((session) => session.id).sort(), [
    'askPending',
    'externalBasic',
    'harnessNoise',
    'prose',
    'resumeParent',
    'rollout-codexParent',
    'setupAnswered',
    'shellRunning',
    'strandedResume',
    'subagentTail',
    'toolCalls',
  ])
  assert.deepEqual(
    list.sessions.filter((session) => session.archived).map((session) => session.id),
    [],
  )
  await proveArchivedPage(page)
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

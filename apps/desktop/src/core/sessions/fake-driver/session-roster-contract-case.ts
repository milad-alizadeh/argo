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

// A real archive round trip (#2194): archiving moves `harnessNoise` out of the active list and
// into the Archived page, and restoring it (the shape a short-lived Undo calls) brings it back.
// Both calls flip the same fixture row `session-feed-fixture.ts` wrote for it, so this leaves the
// fixture exactly as every other case in this file finds it.
async function proveBulkArchive(page) {
  const archived = await page.evaluate(() =>
    window.argo.setSessionsArchived({ sessionIds: ['harnessNoise'], archived: true }),
  )
  assert.equal(archived.type, 'session.archive.applied')
  assert.deepEqual(archived, {
    version: 1,
    type: 'session.archive.applied',
    requestId: archived.requestId,
    archived: true,
    applied: ['harnessNoise'],
    failed: [],
  })
  const afterArchive = await page.evaluate(() => window.argo.listSessions())
  assert.ok(!afterArchive.sessions.some((session) => session.id === 'harnessNoise'))
  const archivedPage = await page.evaluate(() =>
    window.argo.listArchivedSessions({ cursor: null, restoreId: null }),
  )
  assert.ok(archivedPage.sessions.some((session) => session.id === 'harnessNoise'))

  const restored = await page.evaluate(() =>
    window.argo.setSessionsArchived({ sessionIds: ['harnessNoise'], archived: false }),
  )
  assert.deepEqual(restored.applied, ['harnessNoise'])
  const afterRestore = await page.evaluate(() => window.argo.listSessions())
  assert.ok(afterRestore.sessions.some((session) => session.id === 'harnessNoise'))

  // A Session the store has no row for at all fails rather than the write inventing one.
  const unknown = await page.evaluate(() =>
    window.argo.setSessionsArchived({ sessionIds: ['not-a-session'], archived: true }),
  )
  assert.deepEqual(unknown.applied, [])
  assert.deepEqual(unknown.failed, ['not-a-session'])
}

export async function proveContract(page) {
  const list = await page.evaluate(() => window.argo.listSessions({ projectRoot: null }))
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
  await proveBulkArchive(page)
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

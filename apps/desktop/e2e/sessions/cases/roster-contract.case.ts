import assert from 'node:assert/strict'
import { CLAUDE_FEED_REQUEST, CODEX_FEED_REQUEST } from '../proof-requests'

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

// A real archive round trip (#2194, #2315): archiving moves the Session out of the active list and
// into the Archived page, and restoring it (the shape a short-lived Undo calls) brings it back.
// Both calls write Argo's own archive document, and the Claude Session and the Codex one take this one path.
async function proveArchiveRoundTrip(page, sessionId) {
  const archived = await page.evaluate(
    (id) => window.argo.setSessionsArchived({ sessionIds: [id], archived: true }),
    sessionId,
  )
  assert.deepEqual(archived, {
    version: 1,
    type: 'session.archive.applied',
    requestId: archived.requestId,
    archived: true,
    applied: [sessionId],
    failed: [],
  })
  const afterArchive = await page.evaluate(() => window.argo.listSessions({ projectRoot: null }))
  assert.ok(!afterArchive.sessions.some((session) => session.id === sessionId))
  const archivedPage = await page.evaluate(() =>
    window.argo.listArchivedSessions({ cursor: null, restoreId: null }),
  )
  assert.ok(archivedPage.sessions.some((session) => session.id === sessionId))
  const restored = await page.evaluate(
    (id) => window.argo.setSessionsArchived({ sessionIds: [id], archived: false }),
    sessionId,
  )
  assert.deepEqual(restored.applied, [sessionId])
  const afterRestore = await page.evaluate(() => window.argo.listSessions({ projectRoot: null }))
  assert.ok(afterRestore.sessions.some((session) => session.id === sessionId))
}

async function proveBulkArchive(page) {
  await proveArchiveRoundTrip(page, 'harnessNoise')
  await proveArchiveRoundTrip(page, 'rollout-codexParent')
  // The round trip above bypasses the renderer, so a refresh that landed between its two calls left the row hidden.
  await page.reload()
  await page.locator('nav[aria-label="Sessions"] button[data-session-id="harnessNoise"]').waitFor()

  // Argo owns the flag, so a Session it has never discovered archives too: it writes its own row
  // rather than looking for one in another app's store (#2315).
  const unknown = await page.evaluate(() =>
    window.argo.setSessionsArchived({ sessionIds: ['not-a-session'], archived: true }),
  )
  assert.deepEqual(unknown.applied, ['not-a-session'])
  assert.deepEqual(unknown.failed, [])
  await page.evaluate(() =>
    window.argo.setSessionsArchived({ sessionIds: ['not-a-session'], archived: false }),
  )
}

export async function proveContract(page) {
  const list = await page.evaluate(() => window.argo.listSessions({ projectRoot: null }))
  assert.equal(list.type, 'session.listed')
  // Earlier cases add Claude transcripts; two Codex fixtures also lack valid turn timestamps.
  assert.ok(list.filesFound >= 15)
  assert.equal(list.filesRead, list.filesFound)
  assert.ok(list.filesUnreadable >= 2)
  // An archived Session never projects into this active list (#1593): `plannedWork` is read out
  // of it below instead.
  assert.deepEqual(list.sessions.map((session) => session.id).sort(), [
    '11111111-2222-4333-8444-555555555555',
    'askPending',
    'harnessNoise',
    'prose',
    'resumeParent',
    'rollout-codexChild',
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
  assert.deepEqual(
    [...new Set(list.sessions.map((session) => session.posture))],
    ['external', 'watched'],
  )
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
  assert.equal(codexRead.chainId, 'rollout-codexChild')
  assert.equal(codexRead.rows.length, 2)
  const missing = await page.evaluate((value) => window.argo.readSessionFeed(value), {
    ...CLAUDE_FEED_REQUEST,
    sessionId: 'not-a-session',
  })
  assert.equal(missing.code, 'missing-session')
}

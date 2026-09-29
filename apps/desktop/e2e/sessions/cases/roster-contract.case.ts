import assert from 'node:assert/strict'
import { archiveList, archiveSet, feedRows, sessionFeed, sessionRows } from '../page-trpc'

async function proveArchiveRoundTrip(page, sessionId) {
  const archived = await archiveSet(page, [sessionId], true)
  assert.deepEqual(archived, { applied: [sessionId], failed: [] })
  const afterArchive = await sessionRows(page)
  assert.ok(!afterArchive.some((session) => session.id === sessionId))
  const archivedPage = await archiveList(page, null, null)
  assert.ok(archivedPage.sessions.some((session) => session.id === sessionId))
  assert.equal(archivedPage.sessions.find((session) => session.id === sessionId)?.archived, true)
  const restored = await archiveSet(page, [sessionId], false)
  assert.deepEqual(restored.applied, [sessionId])
  const afterRestore = await sessionRows(page)
  assert.ok(afterRestore.some((session) => session.id === sessionId))
}

export async function proveContract(page) {
  const list = await sessionRows(page)
  assert.ok(list.length > 0, 'the active roster listed no Session')
  assert.deepEqual(
    list.filter((session) => session.archived).map((session) => session.id),
    [],
  )
  assert.ok(list.every((session) => session.posture === null || session.posture === 'live'))
  const [first, second] = list
  await proveArchiveRoundTrip(page, first.id)
  if (second !== undefined) await proveArchiveRoundTrip(page, second.id)
  await page.reload()
  await page.waitForFunction(() => typeof window.argo?.trpc === 'function')
  await page.locator(`nav[aria-label="Sessions"] button[data-session-id="${first.id}"]`).waitFor()

  const unknown = await archiveSet(page, ['not-a-session'], true)
  assert.deepEqual(unknown.applied, [])
  assert.deepEqual(unknown.failed, ['not-a-session'])

  const reading = await sessionFeed(page, first.id)
  assert.equal(reading.type, 'session.feed.reading')
  assert.equal(reading.chainId, first.id)
  assert.ok(feedRows(reading).length > 0)
  const missing = await sessionFeed(page, 'not-a-session')
  assert.equal(missing.error?.code, 'missing-session')
}

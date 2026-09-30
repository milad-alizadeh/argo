import assert from 'node:assert/strict'
import { feedRows, sessionFeed, sessionRows, updateSession } from '../page-trpc'

async function proveArchiveRoundTrip(page, sessionId) {
  const [archived] = await updateSession(page, { sessionIds: [sessionId], archived: true })
  assert.equal(archived?.archived, true)
  const afterArchive = await sessionRows(page)
  assert.ok(!afterArchive.some((session) => session.id === sessionId))
  const archivedPage = await sessionRows(page, 'archived')
  assert.equal(archivedPage.find((session) => session.id === sessionId)?.archived, true)
  const [restored] = await updateSession(page, { sessionIds: [sessionId], archived: false })
  assert.equal(restored?.archived, false)
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

  assert.deepEqual(
    await updateSession(page, { sessionIds: ['not-a-session'], archived: true }),
    [],
  )

  const reading = await sessionFeed(page, first.id)
  assert.equal(reading.type, 'session.feed.reading')
  assert.equal(reading.chainId, first.id)
  assert.ok(feedRows(reading).length > 0)
  const missing = await sessionFeed(page, 'not-a-session')
  assert.equal(missing.error?.code, 'missing-session')
}

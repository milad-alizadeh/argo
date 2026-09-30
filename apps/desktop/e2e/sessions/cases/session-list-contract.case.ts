import assert from 'node:assert/strict'
import { feedRows, sendSessionUpdate, sessionDetails, sessionFeed, sessionRows } from '../page-trpc'

async function proveArchiveRoundTrip(page, sessionId) {
  assert.deepEqual(await sendSessionUpdate(page, { sessionIds: [sessionId], archived: true }), {
    sessionIds: [sessionId],
  })
  assert.equal((await sessionDetails(page, sessionId))?.archived, true)
  const afterArchive = await sessionRows(page)
  assert.ok(!afterArchive.some((session) => session.id === sessionId))
  const archivedPage = await sessionRows(page, 'archived')
  assert.equal(archivedPage.find((session) => session.id === sessionId)?.archived, true)
  await sendSessionUpdate(page, { sessionIds: [sessionId], archived: false })
  assert.equal((await sessionDetails(page, sessionId))?.archived, false)
  const afterRestore = await sessionRows(page)
  assert.ok(afterRestore.some((session) => session.id === sessionId))
}

export async function proveContract(page) {
  const list = await sessionRows(page)
  assert.ok(list.length > 0, 'the active Session List listed no Session')
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
    await sendSessionUpdate(page, { sessionIds: ['not-a-session'], archived: true }),
    {
      sessionIds: [],
    },
  )

  const reading = await sessionFeed(page, first.id)
  assert.equal(reading.type, 'session.feed.reading')
  assert.equal(reading.chainId, first.id)
  assert.ok(feedRows(reading).length > 0)
  const missing = await sessionFeed(page, 'not-a-session')
  assert.equal(missing.error?.code, 'missing-session')
}

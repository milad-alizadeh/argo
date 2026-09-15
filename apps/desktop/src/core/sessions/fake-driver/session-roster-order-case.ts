import assert from 'node:assert/strict'
import { openArchivedSection, openSessionByClick } from './session-gestures'
import { readRosterIds } from './session-roster-facts'

const ACTIVE_ROW = 'nav[aria-label="Sessions"] button[data-archived="false"]'

function archivedRow(sessionId: string) {
  return `nav[aria-label="Sessions"] button[data-session-id="${sessionId}"][data-archived="true"]`
}

async function waitForActiveSessions(page, expected) {
  await page.waitForFunction(
    ({ selector, ids }) => {
      const rows = [...document.querySelectorAll(selector)]
      return rows.map((row) => row.getAttribute('data-session-id')).join('|') === ids.join('|')
    },
    { selector: ACTIVE_ROW, ids: expected },
  )
}

async function proveVisibleNames(page) {
  const claude = page.locator('nav[aria-label="Sessions"] button[data-session-id="harnessNoise"]')
  await claude.waitFor()
  assert.equal((await claude.textContent())?.includes('/effort'), true)
  await claude.click()
  await page.waitForSelector('.feed__viewport[data-session="harnessNoise"] [data-feed-row]')
  assert.equal(
    await page
      .locator('.feed__viewport[data-session="harnessNoise"] [data-feed-row]', {
        hasText: 'Set effort level to medium',
      })
      .count(),
    1,
  )
  await page
    .locator('nav[aria-label="Sessions"] button[data-session-id="rollout-codexParent"]')
    .click()
  assert.equal(
    (
      await page
        .locator('nav[aria-label="Sessions"] button[data-session-id="rollout-codexParent"]')
        .textContent()
    )?.includes('Run Codex check'),
    true,
  )
  await page.waitForSelector('.feed__viewport[data-session="rollout-codexParent"] [data-feed-row]')
  assert.equal(
    await page
      .locator('.feed__viewport[data-session="rollout-codexParent"] [data-feed-row]', {
        hasText: 'Checking...',
      })
      .count(),
    1,
  )
}

async function proveUpdatedRowsStayPut(page, mutations) {
  await openSessionByClick(page, 'prose')
  await page.waitForSelector('.feed__viewport[data-session="prose"] [data-feed-row]')
  const before = await readRosterIds(page)
  const focused = page.locator('nav[aria-label="Sessions"] button').nth(1)
  await focused.focus()
  const focusedId = await focused.getAttribute('data-session-id')
  await mutations.update()
  await page.waitForSelector(
    'nav[aria-label="Sessions"] button[data-session-id="prose"]:has-text("Prose renamed in place")',
  )
  assert.deepEqual(await readRosterIds(page), before)
  const updated = await page.evaluate(async () => {
    const reply = await window.argo.listSessions({ projectRoot: null })
    return reply.type === 'session.listed'
      ? reply.sessions.find((session) => session.id === 'prose')
      : null
  })
  assert.deepEqual(
    {
      title: updated?.title?.text,
      status: updated?.status,
      updatedAt: updated?.updatedAt,
      activity: updated?.activity,
    },
    {
      title: 'Prose renamed in place',
      status: 'idle',
      updatedAt: '2098-01-01T00:00:00.000Z',
      activity: { tool: 'Read', target: 'order.ts' },
    },
  )
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute('data-session-id')),
    focusedId,
  )
  return before
}

async function proveArchiveOrderAndFocus(page, mutations, withParent) {
  await openArchivedSection(page)
  await page.locator(archivedRow('plannedWork')).waitFor()
  const archivedBefore = await readRosterIds(page, 'Archived')
  await page.locator('nav[aria-label="Sessions"] button[data-session-id="askPending"]').focus()
  await mutations.archive('askPending', true)
  const active = withParent.filter((sessionId) => sessionId !== 'askPending')
  await waitForActiveSessions(page, active)
  assert.equal(await page.locator('nav[aria-label="Sessions"] button[tabindex="0"]').count(), 1)
  assert.equal(
    active.includes(
      await page.evaluate(() => document.activeElement?.getAttribute('data-session-id') ?? ''),
    ),
    true,
  )
  // The active list polls; the archived list is read on demand (#1593), so a live mutation only
  // reaches it once the reader asks again — closing and reopening the section is that ask.
  await page.locator('[data-slot="archived-toggle"]').click()
  await page.locator('[data-slot="archived-toggle"]').click()
  await page.locator(archivedRow('askPending')).waitFor()
  const archivedAfter = await readRosterIds(page, 'Archived')
  assert.deepEqual(
    archivedAfter.filter((sessionId) => sessionId !== 'askPending'),
    archivedBefore,
  )
  // Archiving dropped askPending from the roster's remembered order (see `keepRosterOrder` in
  // use-sessions.ts), so restoring it reintroduces it as an unrecognised row: it lands at the end,
  // the same place a newly discovered Session lands above.
  await mutations.archive('askPending', false)
  const restored = [...active, 'askPending']
  await waitForActiveSessions(page, restored)
  assert.deepEqual(await readRosterIds(page), restored)
}

export async function proveStableRosterPolling(page, mutations) {
  await proveVisibleNames(page)
  const before = await proveUpdatedRowsStayPut(page, mutations)
  await mutations.addReplacementChild()
  await waitForActiveSessions(page, [...before, 'replacementChild'])
  await page
    .locator('nav[aria-label="Sessions"] button[data-session-id="replacementChild"]')
    .focus()
  await mutations.addReplacementParent()
  const withParent = [...before, 'replacementParent']
  await waitForActiveSessions(page, withParent)
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute('data-session-id')),
    'replacementParent',
  )
  await mutations.addRecent()
  const newlyDiscovered = ['newSessionTwo', 'newSession']
  const withRecent = [...withParent, ...newlyDiscovered]
  await waitForActiveSessions(page, withRecent)
  await page.locator('nav[aria-label="Sessions"] button[data-session-id="newSessionTwo"]').focus()
  await mutations.removeRecent()
  await waitForActiveSessions(page, withParent)
  assert.equal(await page.locator('nav[aria-label="Sessions"] button[tabindex="0"]').count(), 1)
  assert.equal(
    withParent.includes(
      await page.evaluate(() => document.activeElement?.getAttribute('data-session-id') ?? ''),
    ),
    true,
  )
  await proveArchiveOrderAndFocus(page, mutations, withParent)
}

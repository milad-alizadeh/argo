import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { chooseRosterStatus, openSessionByClick } from '../gestures'
import { readRosterIds, waitForActiveSessions } from '../roster-facts'

function archivedRow(sessionId: string) {
  return `nav[aria-label="Sessions"] button[data-session-id="${sessionId}"][data-archived="true"]`
}

async function proveVisibleNames(page) {
  const claude = page.locator('nav[aria-label="Sessions"] button[data-session-id="harnessNoise"]')
  await claude.waitFor()
  await expect(claude).toContainText('/effort')
  await claude.click()
  await page.waitForSelector('.feed__viewport[data-session="harnessNoise"] [data-feed-row]')
  await expect(
    page.locator('.feed__viewport[data-session="harnessNoise"] [data-feed-row]', {
      hasText: 'Set effort level to medium',
    }),
  ).toHaveCount(1)
  const codex = page.locator(
    'nav[aria-label="Sessions"] button[data-session-id="rollout-codexParent"]',
  )
  await codex.click()
  await expect(codex).toContainText('Run Codex check')
  await page.waitForSelector('.feed__viewport[data-session="rollout-codexParent"] [data-feed-row]')
  await expect(
    page.locator('.feed__viewport[data-session="rollout-codexParent"] [data-feed-row]', {
      hasText: 'Checking...',
    }),
  ).toHaveCount(1)
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
      activity: { label: 'Read order.ts', tool: 'Read', target: 'order.ts' },
    },
  )
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute('data-session-id')),
    focusedId,
  )
  return before
}

async function proveArchiveOrderAndFocus(page, withParent) {
  await chooseRosterStatus(page, 'All')
  await page.locator(archivedRow('plannedWork')).waitFor()
  const archivedBefore = await readRosterIds(page, 'Archived')
  await page.locator('nav[aria-label="Sessions"] button[data-session-id="askPending"]').focus()
  await page.evaluate(() =>
    window.argo.setSessionsArchived({ sessionIds: ['askPending'], archived: true }),
  )
  const active = withParent.filter((sessionId) => sessionId !== 'askPending')
  await waitForActiveSessions(page, active)
  await expect(page.locator('nav[aria-label="Sessions"] button[tabindex="0"]')).toHaveCount(1)
  assert.equal(
    active.includes(
      await page.evaluate(() => document.activeElement?.getAttribute('data-session-id') ?? ''),
    ),
    true,
  )
  // The active list refreshes itself; the archived list is read on demand (#1593), so a live
  // mutation only reaches it once the reader asks again, and picking the status again is that ask.
  await chooseRosterStatus(page, 'Active')
  await chooseRosterStatus(page, 'All')
  await page.locator(archivedRow('askPending')).waitFor()
  const archivedAfter = await readRosterIds(page, 'Archived')
  assert.deepEqual(
    archivedAfter.filter((sessionId) => sessionId !== 'askPending'),
    archivedBefore,
  )
  // The reader is showing All, so the archived row stayed in the list and kept its place in the
  // roster's remembered order (`keepRosterOrder` in session-roster-query.ts). Restoring it therefore
  // returns it to that place rather than to the head, where a newly discovered Session lands.
  await page.evaluate(() =>
    window.argo.setSessionsArchived({ sessionIds: ['askPending'], archived: false }),
  )
  await waitForActiveSessions(page, withParent)
  assert.deepEqual(await readRosterIds(page), withParent)
}

export async function proveStableRosterPolling(page, mutations) {
  await proveVisibleNames(page)
  const before = await proveUpdatedRowsStayPut(page, mutations)
  await mutations.addReplacementChild()
  await waitForActiveSessions(page, ['replacementChild', ...before])
  await page
    .locator('nav[aria-label="Sessions"] button[data-session-id="replacementChild"]')
    .focus()
  await mutations.addReplacementParent()
  const withParent = ['replacementParent', ...before]
  await waitForActiveSessions(page, withParent)
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute('data-session-id')),
    'replacementParent',
  )
  await mutations.addRecent()
  const newlyDiscovered = ['newSessionTwo', 'newSession']
  const withRecent = [...newlyDiscovered, ...withParent]
  await waitForActiveSessions(page, withRecent)
  await page.locator('nav[aria-label="Sessions"] button[data-session-id="newSessionTwo"]').focus()
  await mutations.removeRecent()
  await waitForActiveSessions(page, withParent)
  await expect(page.locator('nav[aria-label="Sessions"] button[tabindex="0"]')).toHaveCount(1)
  assert.equal(
    withParent.includes(
      await page.evaluate(() => document.activeElement?.getAttribute('data-session-id') ?? ''),
    ),
    true,
  )
  await proveArchiveOrderAndFocus(page, withParent)
}

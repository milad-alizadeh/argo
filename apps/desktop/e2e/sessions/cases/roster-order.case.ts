import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { chooseRosterStatus, openSessionByClick, visibleArchiveMenuItem } from '../gestures'
import { readRosterIds, waitForActiveSessions } from '../roster-facts'

function archivedRow(sessionId: string) {
  return `nav[aria-label="Sessions"] button[data-session-id="${sessionId}"][data-archived="true"]`
}

async function proveOneFeedRow(page, sessionId: string, hasText: string) {
  await page.waitForSelector(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
  await expect(
    page.locator(
      `section[aria-label="Session history"][data-session="${sessionId}"] [data-feed-row]`,
      { hasText },
    ),
  ).toHaveCount(1)
}

async function proveVisibleNames(page) {
  const claude = page.locator('nav[aria-label="Sessions"] button[data-session-id="harnessNoise"]')
  await claude.waitFor()
  await expect(claude).toContainText('/effort')
  await claude.click()
  await proveOneFeedRow(page, 'harnessNoise', 'Set effort level to medium')
  const codex = page.locator(
    'nav[aria-label="Sessions"] button[data-session-id="rollout-codexParent"]',
  )
  await codex.click()
  await expect(codex).toContainText('Run Codex check')
  await proveOneFeedRow(page, 'rollout-codexParent', 'Checking...')
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
      activity: {
        label: 'Read order.ts',
        kind: 'read',
        open: true,
        tool: 'Read',
        target: 'order.ts',
      },
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
  const askPending = page.locator('nav[aria-label="Sessions"] button[data-session-id="askPending"]')
  await askPending.click({ button: 'right' })
  await visibleArchiveMenuItem(page).click()
  const active = withParent.filter((sessionId) => sessionId !== 'askPending')
  await waitForActiveSessions(page, active)
  await expect(page.locator('nav[aria-label="Sessions"] button[tabindex="0"]')).toHaveCount(1)
  await chooseRosterStatus(page, 'Archived')
  const archivedAskPending = page.locator(archivedRow('askPending'))
  await expect(archivedAskPending).toBeVisible()
  await expect(archivedAskPending.locator('[data-slot="archived-session"]')).toHaveText('Archived')
  const archivedAfter = await readRosterIds(page, 'Archived')
  assert.deepEqual(
    archivedAfter.filter((sessionId) => sessionId !== 'askPending'),
    archivedBefore,
  )
  await chooseRosterStatus(page, 'All')
  await expect(page.locator(archivedRow('askPending'))).toBeVisible()
  await chooseRosterStatus(page, 'Active')
  const range = active.slice(0, 3)
  const first = page.locator(`nav[aria-label="Sessions"] button[data-session-id="${range[0]}"]`)
  const last = page.locator(`nav[aria-label="Sessions"] button[data-session-id="${range[2]}"]`)
  await first.click({ modifiers: ['Meta'] })
  await last.click({ modifiers: ['Shift'] })
  for (const sessionId of range) {
    await expect(
      page.locator(`nav[aria-label="Sessions"] button[data-session-id="${sessionId}"]`),
    ).toContainText('Selected')
  }
  await last.click({ button: 'right' })
  await visibleArchiveMenuItem(page).click()
  const remaining = active.filter((sessionId) => !range.includes(sessionId))
  await waitForActiveSessions(page, remaining)
  await chooseRosterStatus(page, 'Archived')
  for (const sessionId of range) {
    await expect(page.locator(archivedRow(sessionId))).toBeVisible()
  }
  await chooseRosterStatus(page, 'All')
  for (const sessionId of range) {
    await expect(page.locator(archivedRow(sessionId))).toBeVisible()
  }
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

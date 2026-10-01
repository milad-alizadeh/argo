// The gestures a person makes in the Sessions surface, for the packaged drivers to make the same
// way (#2117). Creating a Session goes through the composer, which is where a cluster of creation
// bugs reached the user.

import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import type { Harness } from '@/harnesses/harness'
import { selectedProjectId, sessionRows } from './page-trpc'

// The harness tab labels, typed against Harness so a new Harness cannot be left out. The strings
// themselves live in the renderer's turn turnConfiguration (claude-turn-configuration.ts, codex-turn-configuration.ts), which
// the driver bundle cannot import: the path there runs through the `@/` alias, and the bundler CI
// runs leaves that unresolved.
const HARNESS_TABS: Record<Harness, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  'claude-acp': 'Claude ACP',
}
const BUDGET_MODELS: Record<Harness, RegExp> = {
  claude: /Haiku 4\.5/,
  codex: /Gpt 5\.6 Luna/,
  'claude-acp': /sonnet/,
}

const ROW = 'nav[aria-label="Sessions"] button[data-session-id]'
export const PERSISTED_ROW = `${ROW}:not([data-session-id^="optimistic:"])`
const FILTER = 'button[aria-label="Filter Sessions"]'
export const TURN_CONFIGURATION = '[aria-label^="Choose Turn configuration"]'
const ROW_TIMEOUT = 30_000
const POLL_MS = 25

export type CreateRequest = {
  harness: Harness
  prompt: string
  budgetTurnConfiguration?: boolean
  permissionMode?: 'auto'
}

type CreatedRow = { id: string; label: string; matchingRows: number }

// A Session route sits under its Project: `#/projects/<id>/sessions/<route>`, and keeps the
// Session List filter's query (`?status=all`) after it.
async function waitForRoute(page: Page, route: string) {
  await page.waitForFunction((tail) => {
    const routed = window.location.hash.split('?')[0]
    return /^#\/projects\/[^/]+\/sessions\//.test(routed) && routed.endsWith(tail)
  }, `/sessions/${route}`)
}

// A "+" click opens a fresh composer (#2109): with a Project open, that composer already carries
// an optimistic Session id, so the route past the click is that id, not the literal `new`.
async function waitForNewSessionRoute(page: Page) {
  await page.waitForFunction(() =>
    /^#\/projects\/[^/]+\/sessions\/(new|optimistic:)/.test(window.location.hash),
  )
}

// Opening a Session is a click on its Session List row, the way a person opens one.
export async function openSessionByClick(page: Page, sessionId: string) {
  await page.locator(`${ROW}[data-session-id="${sessionId}"]`).click()
  await waitForRoute(page, sessionId)
}

export function visibleArchiveMenuItem(page: Page) {
  return page.locator('[role="menuitem"]:visible').filter({ hasText: 'Archive' })
}

// Sessions a Harness wrote after launch reach the Session List when the reader asks for a refresh.
export async function refreshSessions(page: Page) {
  await page.locator(FILTER).click()
  await page.getByRole('menuitem', { name: 'Refresh Sessions' }).click()
  await page.getByRole('menu').waitFor({ state: 'detached' })
  await expect(page.getByRole('progressbar', { name: 'Session refresh progress' })).toHaveCount(0)
}

// The plus control above the Session List: the only way to the new Session composer.
export async function openNewSessionByClick(page: Page) {
  await page.getByRole('button', { name: 'New Session', exact: true }).click()
  await waitForNewSessionRoute(page)
}

// The route a Session opens under, inside the open Project.
export async function sessionRoute(page: Page, sessionId: string | null) {
  const projectId = await selectedProjectId(page)
  return `#/projects/${projectId}/sessions${sessionId === null ? '' : `/${sessionId}`}`
}

// No affordance reaches the Session List with nothing selected: a person lands there by launching, and
// several cases need that state mid-run.
export async function deselectSession(page: Page) {
  const route = await sessionRoute(page, null)
  await page.evaluate((hash) => {
    window.location.hash = hash
  }, route)
}

// A Session's own route, the way a link to it opens it.
export async function openSessionByRoute(page: Page, sessionId: string) {
  const route = await sessionRoute(page, sessionId)
  await page.evaluate((hash) => {
    window.location.hash = hash
  }, route)
  await waitForRoute(page, sessionId)
}

// The harness tabs inside the Turn configuration popover, dismissed the way a person dismisses it.
export async function chooseHarness(page: Page, harness: Harness) {
  await page.locator(TURN_CONFIGURATION).click()
  // Keyboard tab selection remains valid while the turn-configuration surface re-renders its controls.
  await page.getByRole('tab', { name: HARNESS_TABS[harness] }).press('Enter')
  await page.keyboard.press('Escape')
  await page.getByRole('tablist', { name: 'Harness' }).waitFor({ state: 'detached' })
}

async function chooseBudgetTurnConfiguration(page: Page, harness: Harness) {
  await page.locator(TURN_CONFIGURATION).click()
  const models = page.getByRole('radiogroup', { name: 'Model' })
  const model = models.getByRole('radio', {
    name: BUDGET_MODELS[harness],
  })
  await model.focus()
  await page.keyboard.press('Space')
  const effort = page.getByRole('slider', { name: 'Effort' })
  await effort.focus()
  await page.keyboard.press('Home')
  await expect(effort).toHaveAttribute('aria-valuetext', 'Low')
  await page.keyboard.press('Escape')
  await models.waitFor({ state: 'detached' })
}

async function chooseAutoPermissionMode(page: Page) {
  const mode = page.getByRole('button', { name: /Choose permission mode/ })
  await mode.focus()
  await page.keyboard.press('Enter')
  await page
    .getByRole('menuitemradio', { name: 'Auto Claude handles permission decisions' })
    .click()
  await page.keyboard.press('Escape')
  await expect(mode).toContainText('Auto')
}

// The Session List ids the shipped app answers with. Reading is an assertion, not a gesture: nothing a
// person does is injected here.
export async function sessionListIds(page: Page): Promise<string[]> {
  const rows = await sessionRows(page)
  return rows.map(({ id }) => id)
}

function readCreatedRow(page: Page, known: string[], prompt: string) {
  return page.evaluate(
    ({ selector, ids, prompt }) => {
      const created = [...document.querySelectorAll<HTMLButtonElement>(selector)].filter(
        (row) => !ids.includes(row.dataset.sessionId ?? ''),
      )
      // Focused and on the real id: the optimistic row carries the prompt too (#2430).
      const first = created.find(
        (row) =>
          row.getAttribute('aria-current') === 'page' &&
          row.textContent?.includes(prompt) &&
          !(row.dataset.sessionId ?? '').startsWith('optimistic:'),
      )
      if (first === undefined) return null
      const matchingRows = created.filter(
        (row) =>
          row.textContent?.includes(prompt) &&
          !(row.dataset.sessionId ?? '').startsWith('optimistic:'),
      )
      return {
        id: first.dataset.sessionId ?? '',
        label: first.textContent ?? '',
        matchingRows: matchingRows.length,
      }
    },
    { selector: ROW, ids: known, prompt },
  )
}

async function waitForCreatedRow(
  page: Page,
  known: string[],
  request: CreateRequest,
): Promise<CreatedRow> {
  const deadline = Date.now() + ROW_TIMEOUT
  for (;;) {
    const created = await readCreatedRow(page, known, request.prompt)
    if (created !== null) return created
    if (Date.now() > deadline) throw new Error('Sending from the new Session composer made no row.')
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
}

// Types into the open Composer and sends with Enter.
export async function sendFromComposer(page: Page, text: string) {
  const composer = page.getByRole('combobox', { name: 'Message' })
  await composer.click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
}

// Clicks the plus control, picks the harness, types the prompt and sends it, then answers with the
// id of the Session that gesture made.
export async function createSessionByClick(page: Page, request: CreateRequest): Promise<string> {
  const known = await sessionListIds(page)
  await openNewSessionByClick(page)
  await chooseHarness(page, request.harness)
  if (request.budgetTurnConfiguration === true)
    await chooseBudgetTurnConfiguration(page, request.harness)
  if (request.permissionMode === 'auto') await chooseAutoPermissionMode(page)
  const composer = page.getByRole('combobox', { name: 'Message' })
  await composer.click()
  await expect(composer).toHaveText('')
  await page.keyboard.type(request.prompt)
  await page.keyboard.press('Enter')

  const created = await waitForCreatedRow(page, known, request)
  // One gesture makes one Session; history refreshes can add unrelated external rows (#2581).
  assert.equal(created.matchingRows, 1)
  return created.id
}

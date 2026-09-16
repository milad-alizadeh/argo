// The gestures a person makes in the Sessions surface, for the packaged drivers to make the same
// way (#2117). Every packaged case used to inherit its Session from an injected
// `window.argo.startSession()`, and that one uncrossed boundary is where a cluster of creation
// bugs reached the user.

import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import type { SessionCli } from '../../src/renderer/modules/sessions/harness/harnesses'

// The harness tab labels, typed against SessionCli so a new CLI cannot be left out. The strings
// themselves live in the renderer's turn setup (claude-turn-setup.ts, codex-turn-setup.ts), which
// the driver bundle cannot import: the path there runs through the `@/` alias, and the bundler CI
// runs leaves that unresolved.
const HARNESS_TABS: Record<SessionCli, string> = { claude: 'Claude Code', codex: 'Codex' }

const ROW = 'nav[aria-label="Sessions"] button[data-session-id]'
const FILTER = 'button[aria-label="Filter Sessions"]'
export const RUN_SETUP = '[aria-label^="Choose run setup"]'
const ROW_TIMEOUT = 30_000
const POLL_MS = 25

export type CreateRequest = {
  cli: SessionCli
  prompt: string
  // Read on every poll while the Roster row is still absent. A true reading fails the case: the
  // row a managed Session stands on must not wait for the CLI to write (managed-row.ts).
  cliWrote?: () => Promise<boolean>
}

type CreatedRow = { id: string; label: string; newRows: number }

async function waitForRoute(page: Page, route: string) {
  await page.waitForFunction((hash) => window.location.hash === hash, `#/sessions/${route}`)
}

// A "+" click opens a fresh composer (#2109): with a Project open, that composer already carries
// an optimistic Session id, so the route past the click is that id, not the literal `new`.
async function waitForNewSessionRoute(page: Page) {
  await page.waitForFunction(() => /^#\/sessions\/(new|optimistic:)/.test(window.location.hash))
}

// Opening a Session is a click on its Roster row, the way a person opens one.
export async function openSessionByClick(page: Page, sessionId: string) {
  await page.locator(`${ROW}[data-session-id="${sessionId}"]`).click()
  await waitForRoute(page, sessionId)
}

// Which Sessions the list holds is a status the reader picks in the header's filter (#2239). "All"
// is the reading that keeps the active rows beside the archived ones, which is what the disclosure
// the filter replaced did.
export async function chooseRosterStatus(page: Page, status: 'Active' | 'Archived' | 'All') {
  await page.locator(FILTER).click()
  const choice = page.getByRole('menuitemradio', { name: status })
  await choice.click()
  // A Base UI radio item takes `closeOnClick = false` (MenuRadioItem.mjs), so the picked status is
  // read off the item and the menu is dismissed by hand rather than waited out.
  await page.getByRole('menuitemradio', { checked: true, name: status }).waitFor()
  await page.keyboard.press('Escape')
  await choice.waitFor({ state: 'detached' })
}

export async function openArchivedSessionByClick(page: Page, sessionId: string) {
  await chooseRosterStatus(page, 'All')
  await page.locator(`${ROW}[data-session-id="${sessionId}"]`).click()
  await waitForRoute(page, sessionId)
}

// The plus control above the Roster: the only way to the new Session composer.
export async function openNewSessionByClick(page: Page) {
  await page.getByRole('button', { name: 'New Session' }).click()
  await waitForNewSessionRoute(page)
}

// No affordance reaches the Roster with nothing selected: a person lands there by launching, and
// several cases need that state mid-run.
export async function deselectSession(page: Page) {
  await page.evaluate(() => {
    window.location.hash = '#/sessions'
  })
}

// The harness tabs inside the run setup popover, dismissed the way a person dismisses it.
export async function chooseHarness(page: Page, cli: SessionCli) {
  await page.locator(RUN_SETUP).click()
  // Keyboard tab selection remains valid while the run-setup surface re-renders its controls.
  await page.getByRole('tab', { name: HARNESS_TABS[cli] }).press('Enter')
  await page.keyboard.press('Escape')
  await page.getByRole('tablist', { name: 'Harness' }).waitFor({ state: 'detached' })
}

// The Roster ids the shipped app answers with. Reading is an assertion, not a gesture: nothing a
// person does is injected here.
export async function rosterIds(page: Page): Promise<string[]> {
  const reply = await page.evaluate(() => window.argo.listSessions({ projectRoot: null }))
  assert.equal(reply.type, 'session.listed')
  return reply.sessions.map(({ id }: { id: string }) => id)
}

function readCreatedRow(page: Page, known: string[], prompt: string) {
  return page.evaluate(
    ({ selector, ids, prompt }) => {
      const created = [...document.querySelectorAll<HTMLButtonElement>(selector)].filter(
        (row) => !ids.includes(row.dataset.sessionId ?? ''),
      )
      // Focused, not merely present: the row a person's gesture made is the one they are reading,
      // and it has to be both before the CLI writes. Its label starts as the optimistic row's own
      // placeholder (#2109) and only carries the prompt once the real Session replaces it, so this
      // waits for that rather than reading the placeholder as the answer.
      const first = created.find(
        (row) => row.getAttribute('aria-current') === 'page' && row.textContent?.includes(prompt),
      )
      if (first === undefined) return null
      return {
        id: first.dataset.sessionId ?? '',
        label: first.textContent ?? '',
        newRows: created.length,
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
    if (request.cliWrote !== undefined) {
      assert.equal(
        await request.cliWrote(),
        false,
        'the CLI wrote before the new Session reached the Roster',
      )
    }
    if (Date.now() > deadline) throw new Error('Sending from the new Session composer made no row.')
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
}

// Clicks the plus control, picks the harness, types the prompt and sends it, then answers with the
// id of the Session that gesture made.
export async function createSessionByClick(page: Page, request: CreateRequest): Promise<string> {
  const known = await rosterIds(page)
  await openNewSessionByClick(page)
  await chooseHarness(page, request.cli)
  const composer = page.getByRole('textbox', { name: 'Message' })
  await composer.click()
  await expect(composer).toHaveText('')
  await page.keyboard.type(request.prompt)
  await page.keyboard.press('Enter')

  const created = await waitForCreatedRow(page, known, request)
  // One gesture makes one Session: a second row is the duplicate-start bug this case exists for.
  assert.equal(created.newRows, 1)
  return created.id
}

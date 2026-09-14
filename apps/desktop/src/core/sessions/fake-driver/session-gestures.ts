// The gestures a person makes in the Sessions surface, for the packaged drivers to make the same
// way (#2117). Every packaged case used to inherit its Session from an injected
// `window.argo.startSession()`, and that one uncrossed boundary is where a cluster of creation
// bugs reached the user.
import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import { HARNESSES, type SessionCli } from '../../../renderer/modules/sessions/harness/harnesses'

const ROW = 'nav[aria-label="Sessions"] button[data-session-id]'
const ARCHIVED = '.roster__archived'
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

// Opening a Session is a click on its Roster row, the way a person opens one.
export async function openSessionByClick(page: Page, sessionId: string) {
  await page.locator(`${ROW}[data-session-id="${sessionId}"]`).click()
  await waitForRoute(page, sessionId)
}

// An archived Session is behind the Archived disclosure, which a person opens before clicking its
// row. The disclosure can already be open, so this reads it rather than toggling it blind.
export async function openArchivedSessionByClick(page: Page, sessionId: string) {
  const disclosure = page.locator(`${ARCHIVED} [data-slot="collapsible-trigger"]`)
  await disclosure.waitFor()
  if ((await disclosure.getAttribute('aria-expanded')) !== 'true') await disclosure.click()
  await page.locator(`nav[aria-label="Archived"] button[data-session-id="${sessionId}"]`).click()
  await waitForRoute(page, sessionId)
}

// The plus control above the Roster: the only way to the new Session composer.
export async function openNewSessionByClick(page: Page) {
  await page.getByRole('button', { name: 'New Session' }).click()
  await waitForRoute(page, 'new')
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
  await page.getByRole('tab', { name: HARNESSES[cli].label }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('tablist', { name: 'Harness' }).waitFor({ state: 'detached' })
}

// The Roster ids the shipped app answers with. Reading is an assertion, not a gesture: nothing a
// person does is injected here.
export async function rosterIds(page: Page): Promise<string[]> {
  const reply = await page.evaluate(() => window.argo.listSessions())
  assert.equal(reply.type, 'session.listed')
  return reply.sessions.map(({ id }: { id: string }) => id)
}

function readCreatedRow(page: Page, known: string[]) {
  return page.evaluate(
    ({ selector, ids }) => {
      const created = [...document.querySelectorAll<HTMLButtonElement>(selector)].filter(
        (row) => !ids.includes(row.dataset.sessionId ?? ''),
      )
      // Focused, not merely present: the row a person's gesture made is the one they are reading,
      // and it has to be both before the CLI writes.
      const first = created.find((row) => row.getAttribute('aria-current') === 'page')
      if (first === undefined) return null
      return {
        id: first.dataset.sessionId ?? '',
        label: first.textContent ?? '',
        newRows: created.length,
      }
    },
    { selector: ROW, ids: known },
  )
}

async function waitForCreatedRow(
  page: Page,
  known: string[],
  cliWrote: CreateRequest['cliWrote'],
): Promise<CreatedRow> {
  const deadline = Date.now() + ROW_TIMEOUT
  for (;;) {
    const created = await readCreatedRow(page, known)
    if (created !== null) return created
    if (cliWrote !== undefined) {
      assert.equal(
        await cliWrote(),
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
  assert.equal(await composer.textContent(), '')
  await page.keyboard.type(request.prompt)
  await page.keyboard.press('Shift+Enter')

  const created = await waitForCreatedRow(page, known, request.cliWrote)
  // One gesture makes one Session: a second row is the duplicate-start bug this case exists for.
  // The Session the gesture made is asserted again once its Feed lands, since a duplicate start
  // reaches the Roster a moment behind the first row.
  assert.equal(created.newRows, 1)
  assert.equal(created.label.includes(request.prompt), true, created.label)
  return created.id
}

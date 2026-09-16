// With no Project selected, the "+" control has nothing to create a Session on: clicking it names
// the next step instead of navigating to the empty state the reader was already looking at
// (#2307). Runs before the proof selects a Project, so the reader here still has none.
import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import { rosterIds } from './session-gestures'

export async function proveNewSessionWithNoProject(page: Page) {
  const known = await rosterIds(page)
  const hint = page.getByRole('heading', { name: 'Select a Project first' })
  await assert.rejects(hint.waitFor({ state: 'attached', timeout: 200 }))

  await page.getByRole('button', { name: 'New Session' }).click()
  await hint.waitFor()
  await page.getByText('Choose a Project, or add one, to start a Session.').waitFor()

  // The hint names the next step; it does not take one for the reader.
  assert.equal(await page.evaluate(() => window.location.hash), '#/sessions')
  assert.deepEqual(await rosterIds(page), known)
}

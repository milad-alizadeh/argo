import assert from 'node:assert/strict'
import { deselectSession } from './session-gestures'

const INSPECTOR_WIDTH = 248

// The shell comes before Session data. This proof reads the shipped route so its geometry and pane
// controls cannot be green because an old Roster or Feed happened to render.
export async function proveSessionShell(page) {
  await deselectSession(page)
  await page.waitForSelector('[data-component="SessionShell"]')

  const inspector = page.locator('aside[aria-label="Session inspector"]')
  if (Math.round((await inspector.boundingBox())?.width ?? 0) !== 0) {
    await page.getByRole('button', { name: 'Collapse Session inspector' }).click()
    await page.waitForFunction(
      () =>
        document.querySelector('[aria-label="Session inspector"]')?.getBoundingClientRect()
          .width === 0,
    )
  }
  assert.equal(Math.round((await inspector.boundingBox())?.width ?? 0), 0)
  await page.getByRole('button', { name: 'Open Session inspector' }).click()
  await page.waitForFunction(
    (inspectorWidth) =>
      document.querySelector('[aria-label="Session inspector"]')?.getBoundingClientRect().width ===
      inspectorWidth,
    INSPECTOR_WIDTH,
  )
  assert.equal(Math.round((await inspector.boundingBox())?.width ?? 0), INSPECTOR_WIDTH)
  await page.getByRole('button', { name: 'Collapse Session inspector' }).click()
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Session inspector"]')?.getBoundingClientRect().width ===
      0,
  )
  assert.equal(Math.round((await inspector.boundingBox())?.width ?? 0), 0)
}

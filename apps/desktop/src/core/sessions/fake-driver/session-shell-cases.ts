import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import { deselectSession } from './session-gestures'

const INSPECTOR_WIDTH = 248

// The panel library reports a sub-pixel width (247.99...), so a strict-equality read of it never
// settles. Rounding matches the boundingBox() assertion below it and is what a person's eye sees.
async function waitForInspectorWidth(page: Page, width: number) {
  await page.waitForFunction(
    (expected) =>
      Math.round(
        document.querySelector('[aria-label="Session inspector"]')?.getBoundingClientRect().width ??
          -1,
      ) === expected,
    width,
  )
}

// The shell comes before Session data. This proof reads the shipped route so its geometry and pane
// controls cannot be green because an old Roster or Feed happened to render.
export async function proveSessionShell(page: Page) {
  await deselectSession(page)
  await page.waitForSelector('[data-component="SessionShell"]')

  const inspector = page.locator('aside[aria-label="Session inspector"]')
  if (Math.round((await inspector.boundingBox())?.width ?? 0) !== 0) {
    await page.getByRole('button', { name: 'Collapse Session inspector' }).click()
    await waitForInspectorWidth(page, 0)
  }
  assert.equal(Math.round((await inspector.boundingBox())?.width ?? 0), 0)
  await page.getByRole('button', { name: 'Open Session inspector' }).click()
  await waitForInspectorWidth(page, INSPECTOR_WIDTH)
  assert.equal(Math.round((await inspector.boundingBox())?.width ?? 0), INSPECTOR_WIDTH)
  await page.getByRole('button', { name: 'Collapse Session inspector' }).click()
  await waitForInspectorWidth(page, 0)
  assert.equal(Math.round((await inspector.boundingBox())?.width ?? 0), 0)
}

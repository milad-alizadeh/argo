import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import { deselectSession } from '../gestures'

// The panel library reports a sub-pixel width, so a strict-equality read of it never
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
// controls cannot be green because an old SessionList or Feed happened to render.
export async function proveSessionShell(page: Page) {
  await deselectSession(page)
  await page.waitForSelector('[data-component="SessionShell"]')
  // The width the shipped token asks for, read off the page so a token change moves this proof too.
  const inspectorWidth = await page.evaluate(() =>
    Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--size-session-inspector'),
    ),
  )
  assert.ok(inspectorWidth > 0, '--size-session-inspector resolves to a width')

  const inspector = page.locator('aside[aria-label="Session inspector"]')
  const roundedWidth = async () => Math.round((await inspector.boundingBox())?.width ?? 0)
  if ((await roundedWidth()) !== 0) {
    await page.getByRole('button', { name: 'Collapse Session inspector' }).click()
    await waitForInspectorWidth(page, 0)
  }
  await expect.poll(roundedWidth).toBe(0)
  await page.getByRole('button', { name: 'Open Session inspector' }).click()
  await waitForInspectorWidth(page, inspectorWidth)
  await expect.poll(roundedWidth).toBe(inspectorWidth)
  await page.getByRole('button', { name: 'Collapse Session inspector' }).click()
  await waitForInspectorWidth(page, 0)
  await expect.poll(roundedWidth).toBe(0)
}

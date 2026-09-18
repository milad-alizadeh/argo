// The recovery proof names only fixture IDs, never their recorded Session text (#2377).
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { expect } from '@playwright/test'
import { openArchivedSessionByClick, openSessionByClick } from '../gestures'

export async function provePackagedIndexRecovery(page, { restart, userData }) {
  await openSessionByClick(page, 'prose')
  await page.waitForSelector('.feed__viewport[data-session="prose"] [data-feed-row]')

  const recovered = await restart(() =>
    rm(path.join(userData, 'cache-v1', 'session-index.db'), { force: true }),
  )

  await expect(
    recovered.locator('nav[aria-label="Sessions"] button[data-session-id="prose"]'),
  ).toBeVisible()
  await recovered.waitForSelector('.feed__viewport[data-session="prose"] [data-feed-row]')
  await openArchivedSessionByClick(recovered, 'plannedWork')
  await expect(
    recovered.locator('nav[aria-label="Sessions"] button[data-session-id="plannedWork"]'),
  ).toBeVisible()
}

import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'

// With no Project selected the cockpit shows no SessionList at all, only the window naming the next step
// (#2307). Fixture Sessions exist on disk here, so an absent SessionList is the gate, not an empty read.
export async function proveNoProjectWindow(page: Page) {
  await page.getByText('Add a Project to start').waitFor({ timeout: 10_000 })
  assert.equal(await page.getByRole('button', { name: 'Add Project…' }).isEnabled(), true)
  await expect(page.getByRole('complementary', { name: 'Sessions sidebar' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'New Session' })).toHaveCount(0)
}

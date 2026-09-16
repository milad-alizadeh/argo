import assert from 'node:assert/strict'
import { expect } from '@playwright/test'

export async function proveDelegationCards(page) {
  await page.evaluate(() => {
    window.location.hash = '#/sessions/harnessNoise'
  })
  // Each card reads its latest entry: the action, its progress line, and the settled state word.
  const agent = page.getByRole('region', { name: 'Background Agent' })
  await agent.waitFor()
  await assert.doesNotReject(() =>
    agent.getByText('Review the Feed card for keyboard access.').waitFor(),
  )
  await assert.doesNotReject(() => agent.getByText('Checking focus and motion').waitFor())
  await expect(agent).toHaveAttribute('data-state', 'running')
  const shell = page.getByRole('region', { name: 'Background Task' })
  await shell.waitFor()
  await assert.doesNotReject(() => shell.getByText('Build completed').waitFor())
  await assert.doesNotReject(() => shell.getByText('Completed', { exact: true }).waitFor())
  await expect(shell.getByText('Started bun run build')).toHaveCount(0)
  await expect(page.locator('[data-slot="feed-delegation"]')).toHaveCount(2)
  await expect(page.getByText(/realtime_delegation|task-notification/)).toHaveCount(0)
}

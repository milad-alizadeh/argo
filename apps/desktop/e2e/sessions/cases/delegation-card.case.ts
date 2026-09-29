import { expect } from '@playwright/test'

// One Subagent the Harness started and has not answered draws one `started` row, in the Feed's
// column, as its title alone. A system context update draws nothing.
export async function proveDelegationCards(page) {
  await page.evaluate(() => {
    window.location.hash = '#/sessions/subagentTail'
  })
  const row = page.locator('.feed__viewport [data-slot="feed-delegation"]')
  await row.waitFor()
  await expect(row).toHaveCount(1)
  await expect(row).toHaveAttribute('data-event', 'started')
  await expect(row).toHaveAttribute('data-subagent', 'call-task-1')
  await expect(page.getByText(/realtime_delegation|task-notification/)).toHaveCount(0)
  await expect(page.getByText(/System context updated|Hand off to review/)).toHaveCount(0)

  // The prompt lives in the Subagent's own Feed, which the row opens.
  await expect(row.getByText('Find the callers')).toHaveCount(0)
}

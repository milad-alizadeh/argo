import { expect } from '@playwright/test'

// One Subagent the Harness started and has not answered draws one `started` row, in the Feed's
// column, with its prompt clamped behind a disclosure. A system context update draws nothing.
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

  await expect(row.getByRole('heading', { name: 'Find the callers' })).toBeVisible()
  const toggle = row.getByRole('button', { name: 'Show full prompt' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(row.getByText('Report the total count last.')).not.toBeInViewport()
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(row.getByRole('button', { name: 'Show less' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await expect(row.getByText('Report the total count last.')).toBeInViewport()
  const [rowWidth, viewportWidth] = await Promise.all([
    row.evaluate((node) => node.scrollWidth),
    page.locator('.feed__viewport').evaluate((node) => node.clientWidth),
  ])
  expect(rowWidth).toBeLessThanOrEqual(viewportWidth)
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
}

import assert from 'node:assert/strict'

export async function proveDelegationCards(page) {
  await page.evaluate(() => {
    window.location.hash = '#/sessions/harnessNoise'
  })
  const agent = page.getByRole('region', { name: 'Background Agent' })
  await agent.waitFor()
  await assert.doesNotReject(() =>
    agent.getByText('Review the Feed card for keyboard access.').waitFor(),
  )
  await assert.doesNotReject(() => agent.getByText('Checking focus and motion').waitFor())
  await assert.doesNotReject(() => agent.getByText('running').waitFor())
  const shell = page.getByRole('region', { name: 'Background Task' })
  await shell.waitFor()
  await assert.doesNotReject(() => shell.getByText('Started bun run build').waitFor())
  await assert.doesNotReject(() => shell.getByText('Build completed').waitFor())
  await assert.doesNotReject(() => shell.getByText('completed', { exact: true }).waitFor())
  assert.equal(await page.locator('[data-slot="feed-delegation"]').count(), 2)
  assert.equal(await page.getByText(/realtime_delegation|task-notification/).count(), 0)
}

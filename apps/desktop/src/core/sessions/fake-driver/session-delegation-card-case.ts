import assert from 'node:assert/strict'

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
  assert.equal(await agent.getAttribute('data-state'), 'running')
  const shell = page.getByRole('region', { name: 'Background Task' })
  await shell.waitFor()
  await assert.doesNotReject(() => shell.getByText('Build completed').waitFor())
  await assert.doesNotReject(() => shell.getByText('Completed', { exact: true }).waitFor())
  assert.equal(await shell.getByText('Started bun run build').count(), 0)
  assert.equal(await page.locator('[data-slot="feed-delegation"]').count(), 2)
  assert.equal(await page.getByText(/realtime_delegation|task-notification/).count(), 0)
}

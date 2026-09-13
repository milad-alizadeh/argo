import assert from 'node:assert/strict'

export async function proveToolCalls(page) {
  await page.evaluate(() => {
    window.location.hash = '#/sessions'
  })
  const toolCalls = page.locator('nav[aria-label="Sessions"] button[data-session-id="toolCalls"]')
  await toolCalls.click()
  await page.waitForFunction(() => window.location.hash === '#/sessions/toolCalls')
  await page.waitForSelector('.feed__viewport[data-session="toolCalls"] [data-feed-row]')
  const group = page.getByRole('button', { name: 'Ran 1 command · Edited 1 file' })
  assert.equal(await group.getAttribute('aria-expanded'), 'false')
  await group.click()
  await page.getByRole('button', { name: /Ran bun test composer/ }).click()
  await page.getByLabel('Command and file inspector').getByText('Ran bun test composer').waitFor()
}

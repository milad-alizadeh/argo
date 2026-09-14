import assert from 'node:assert/strict'

// The whole vertical flow for a background Shell (#1582): the inspector opens on a Session that
// runs no Subagent, the row names the command the CLI was given, selecting it draws what the
// recorded output file holds, and the CLI's completion notification ends the running state.
export async function proveBackgroundShell(page, { writeOutput, complete }) {
  await writeOutput('watching for changes\nrebuilt in 240ms\n')
  await page.evaluate(() => {
    window.location.hash = '#/sessions/shellRunning'
  })
  const rail = page.locator('section[aria-label="Session work"]')
  await rail.waitFor()
  // No Subagent here, so the rail is the Shell section alone.
  assert.equal(await page.getByRole('heading', { name: 'Shell · 3' }).count(), 1)
  assert.equal(await page.getByRole('heading', { name: /Background Agents/ }).count(), 0)

  // The row names the real command and says it is still going.
  const running = page.getByRole('button', { name: /Running.*npm run watch/ })
  await running.waitFor()
  await running.click()

  const pane = page.locator('section[aria-label="Background Shell"]')
  await pane.waitFor()
  await page.getByText('rebuilt in 240ms').waitFor()

  await writeOutput('watching for changes\nrebuilt in 240ms\nwatcher stopped\n')
  await complete()
  await page.waitForFunction(
    () =>
      document
        .querySelector('section[aria-label="Background Shell"]')
        ?.textContent?.includes('exit code 0') === true,
    undefined,
    { timeout: 15_000 },
  )
  await page.getByText('watcher stopped').waitFor()

  // Back to the rail, where the same command now waits behind the finished fold rather than
  // standing in the running list.
  await page.getByRole('button', { name: 'Session work' }).click()
  await rail.waitFor()
  await page.getByRole('button', { name: '2 finished' }).click()
  await page.getByRole('button', { name: /Completed.*npm run watch/ }).waitFor()
}

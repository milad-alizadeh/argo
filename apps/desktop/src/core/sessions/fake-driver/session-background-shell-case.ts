import assert from 'node:assert/strict'

// The whole vertical flow for a background Shell (#1582): the header button counts the commands a
// Session that runs no Subagent has, its list names the command the CLI was given, picking it opens
// the inspector on what the recorded output file holds, and the CLI's completion notification ends
// the running state.
export async function proveBackgroundShell(page, { writeOutput, complete }) {
  await writeOutput('watching for changes\nrebuilt in 240ms\n')
  await page.evaluate(() => {
    window.location.hash = '#/sessions/shellRunning'
  })
  const shellButton = page.getByRole('button', { name: 'Shell · 3' })
  await shellButton.waitFor()
  // No Subagent here, so the header carries the Shell button alone.
  assert.equal(await page.getByRole('button', { name: /^Subagents/ }).count(), 0)

  await shellButton.click()
  const running = page.getByRole('menuitem', { name: /npm run watch/ })
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

  // The same command now waits under Finished rather than Running.
  await shellButton.click()
  const finished = page.getByRole('group', { name: 'Finished' })
  await finished.waitFor()
  await finished.getByRole('menuitem', { name: /npm run watch/ }).waitFor()
}

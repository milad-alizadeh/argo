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

  // A work pick replaces the evidence already open in the inspector.
  const history = page.locator('.feed__viewport[data-session="shellRunning"]')
  await history.evaluate((element) => {
    element.scrollTop = 0
    element.dispatchEvent(new Event('scroll'))
  })
  // Commands render inside a closed tool group. Open the mounted group before looking for its
  // evidence row; querying the row first cannot make a virtualized, collapsed child exist.
  await page.getByRole('button', { name: 'Ran a command' }).waitFor()
  await page.getByRole('button', { name: 'Ran a command' }).click()
  const finishedCommand = page.locator('[data-feed-evidence-id="sh-call-done"]')
  await finishedCommand.waitFor()
  await finishedCommand.click()
  await page.getByText('git status --short').last().waitFor()

  await shellButton.click()
  const running = page.getByRole('menuitem', { name: /npm run watch/ })
  await running.waitFor()
  await running.click()

  const pane = page.locator('section[aria-label="Background Shell"]')
  await pane.waitFor()
  await page.getByText('rebuilt in 240ms').waitFor()
  await shellButton.click()
  assert.equal(await running.getAttribute('aria-current'), 'true')
  await page.keyboard.press('Escape')

  await writeOutput('watching for changes\nrebuilt in 240ms\nwatcher stopped\n')
  await complete()
  await page.getByText(/exit code 0/).waitFor()
  await page.getByText('watcher stopped').waitFor()

  // The same command now waits under Finished rather than Running.
  await shellButton.click()
  const finished = page.getByRole('group', { name: 'Finished' })
  await finished.waitFor()
  await finished.getByRole('menuitem', { name: /npm run watch/ }).waitFor()
  // Closed again, or the open menu's backdrop takes the next case's clicks.
  await page.keyboard.press('Escape')
  await finished.waitFor({ state: 'hidden' })
}

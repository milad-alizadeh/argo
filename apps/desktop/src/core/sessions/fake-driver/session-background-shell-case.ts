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
  await history.focus()
  await page.keyboard.press('Home')
  // Commands render inline, while a Read opens recorded evidence in the inspector. Resolve the
  // exact group holding that Read from the Feed contract, then open its mounted trigger. Several
  // groups share visible titles, so selecting by title alone is not deterministic in the package.
  const evidenceGroupId = await page.evaluate(async () => {
    const feed = await window.argo.readSessionFeed({
      delegationId: null,
      revision: null,
      sessionId: 'shellRunning',
    })
    if (feed.type !== 'session.feed.read') throw new Error('shellRunning Feed did not load')
    const group = feed.rows.find(
      (row) =>
        row.shape === 'tool-group' && row.calls.some((call) => call.id === 'sh-call-package'),
    )
    if (group === undefined || group.shape !== 'tool-group')
      throw new Error('shell package-read group was not returned')
    return group.id
  })
  const evidenceGroup = history.locator(`[data-feed-row="${evidenceGroupId}"]`)
  const evidenceGroupTrigger = evidenceGroup.getByRole('button')
  await evidenceGroupTrigger.waitFor()
  await evidenceGroupTrigger.click()
  const packageRead = evidenceGroup.locator('[data-feed-evidence-id="sh-call-package"]')
  await packageRead.waitFor()
  await packageRead.click()
  assert.equal(await packageRead.getAttribute('aria-current'), 'location')
  await page.locator('section[aria-label="Command and file inspector"]').waitFor()
  await page.getByText('apps/desktop/package.json').last().waitFor()

  await shellButton.click()
  const running = page.getByRole('menuitem', { name: /npm run watch/ })
  await running.waitFor()
  await running.click()

  const pane = page.locator('section[aria-label="Background Shell"]')
  await pane.waitFor()
  await page.locator('section[aria-label="Command and file inspector"]').waitFor({ state: 'hidden' })
  await page.waitForFunction(
    () => document.querySelector('[data-feed-evidence-id="sh-call-package"]')?.getAttribute('aria-current') === null,
  )
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

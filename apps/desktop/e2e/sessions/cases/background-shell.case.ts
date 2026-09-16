import { expect } from '@playwright/test'
import { mountFeedRow } from '../feed-virtualization'

async function openPackageReadEvidence(page) {
  const history = page.locator('.feed__viewport[data-session="shellRunning"]')
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
  await mountFeedRow(page, { rowId: evidenceGroupId, session: 'shellRunning' })
  const evidenceGroup = history.locator(`[data-feed-row="${evidenceGroupId}"]`)
  const evidenceGroupTrigger = evidenceGroup.getByRole('button')
  await evidenceGroupTrigger.waitFor()
  await evidenceGroupTrigger.click()
  const packageRead = evidenceGroup.locator('[data-feed-evidence-id="sh-call-package"]')
  await packageRead.waitFor()
  await packageRead.click()
  await expect(packageRead).toHaveAttribute('aria-current', 'location')
  await page.locator('section[aria-label="Command and file inspector"]').waitFor()
  await page.getByText('Read package.json').last().waitFor()
  await page.getByText(/"name": "desktop"/).waitFor()
  return packageRead
}

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
  await expect(page.getByRole('button', { name: /^Subagents/ })).toHaveCount(0)

  // A work pick replaces evidence already open in the inspector.
  await openPackageReadEvidence(page)

  await shellButton.click()
  const running = page.getByRole('menuitem', { name: /npm run watch/ })
  await running.waitFor()
  await running.click()

  const pane = page.locator('section[aria-label="Background Shell"]')
  await pane.waitFor()
  await page
    .locator('section[aria-label="Command and file inspector"]')
    .waitFor({ state: 'hidden' })
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-feed-evidence-id="sh-call-package"]')
        ?.getAttribute('aria-current') === null,
  )
  await page.getByText('rebuilt in 240ms').waitFor()
  await shellButton.click()
  await expect(running).toHaveAttribute('aria-current', 'true')
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

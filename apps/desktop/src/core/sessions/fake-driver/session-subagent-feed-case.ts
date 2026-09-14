// Picking a Subagent off the rail swaps the Feed for that Subagent's own transcript, and Main is
// the way back to the Session's (#1582).

// The drawn Feed, never the measurement layer behind it, which holds a hidden copy of every row.
function feedSays(page, text) {
  return page.waitForFunction(
    (needle) => document.querySelector('.feed__viewport')?.textContent?.includes(needle) === true,
    text,
    { timeout: 15_000 },
  )
}

export async function proveSubagentFeed(page) {
  await page.evaluate(() => {
    window.location.hash = '#/sessions/subagentTail'
  })
  await page.locator('section[aria-label="Session work"]').waitFor()
  await feedSays(page, 'Search the tree for every caller')

  await page.getByRole('button', { name: /call-task-1/ }).click()
  await feedSays(page, 'Eleven callers, all in the same package.')

  await page.getByRole('button', { name: /Main/ }).click()
  await feedSays(page, 'Search the tree for every caller')
}

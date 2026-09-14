// Picking a Subagent off the header button opens its own transcript in the inspector, beside the
// Session's own Feed rather than in place of it (#1582).

// The drawn Feed, never the measurement layer behind it, which holds a hidden copy of every row.
function textIn(page, selector, text) {
  return page.waitForFunction(
    ([where, needle]) =>
      [...document.querySelectorAll(where)].some(
        (node) => node.textContent?.includes(needle) === true,
      ),
    [selector, text],
    { timeout: 15_000 },
  )
}

export async function proveSubagentFeed(page) {
  await page.evaluate(() => {
    window.location.hash = '#/sessions/subagentTail'
  })
  await textIn(page, '.feed__viewport', 'Search the tree for every caller')

  await page.getByRole('button', { name: /^Subagents/ }).click()
  await page.getByRole('menuitem', { name: /call-task-1/ }).click()

  const pane = page.locator('section[aria-label="Subagent"]')
  await pane.waitFor()
  await textIn(page, 'section[aria-label="Subagent"] .feed__viewport', 'Eleven callers')

  // The Session's own Feed never left the column while the Subagent was open.
  await textIn(page, '.feed__viewport', 'Search the tree for every caller')

  // Picking the same Subagent again reopens an inspector the reader collapsed.
  await page.getByRole('button', { name: 'Collapse Session inspector' }).click()
  await page.getByRole('button', { name: 'Open Session inspector' }).waitFor()
  await page.getByRole('button', { name: /^Subagents/ }).click()
  await page.getByRole('menuitem', { name: /call-task-1/ }).click()
  await page.getByRole('button', { name: 'Collapse Session inspector' }).waitFor()
}

import assert from 'node:assert/strict'

// The shell comes before Session data. This proof reads the shipped route so its geometry and pane
// controls cannot be green because an old Roster or Feed happened to render.
export async function proveSessionShell(page) {
  await page.evaluate(() => {
    window.location.hash = '#/sessions'
  })
  await page.waitForSelector('[data-component="SessionShell"]')

  const inspector = page.getByLabel('Session inspector')
  const workspace = page.getByLabel('Session workspace')
  assert.equal(Math.round((await inspector.boundingBox())?.width ?? 0), 248)
  await page.getByRole('button', { name: 'Collapse Session inspector' }).click()
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Session inspector"]')?.getBoundingClientRect().width ===
      0,
  )
  assert.equal(Math.round((await inspector.boundingBox())?.width ?? 0), 0)
  await page.getByRole('button', { name: 'Open Session inspector' }).click()
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Session inspector"]')?.getBoundingClientRect().width ===
      248,
  )
  assert.equal(Math.round((await inspector.boundingBox())?.width ?? 0), 248)
  await page.getByRole('button', { name: 'Expand Session sidebar' }).click()
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Session workspace"]')?.getBoundingClientRect().width ===
      0,
  )
  assert.equal(Math.round((await workspace.boundingBox())?.width ?? 0), 0)
  await page.getByRole('button', { name: 'Restore Session sidebar' }).click()
  await page.waitForFunction(
    () =>
      (document.querySelector('[aria-label="Session workspace"]')?.getBoundingClientRect().width ??
        0) > 0,
  )
  assert.ok((await workspace.boundingBox())?.width)
}

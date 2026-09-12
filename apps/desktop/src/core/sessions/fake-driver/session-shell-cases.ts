import assert from 'node:assert/strict'

const INSPECTOR_WIDTH = 248

// The shell comes before Session data. This proof reads the shipped route so its geometry and pane
// controls cannot be green because an old Roster or Feed happened to render.
export async function proveSessionShell(page) {
  await page.evaluate(() => {
    window.location.hash = '#/sessions'
  })
  await page.waitForSelector('[data-component="SessionShell"]')

  const inspector = page.locator('aside[aria-label="Session inspector"]')
  const workspace = page.locator('section[aria-label="Session workspace"]')
  assert.equal(Math.round((await inspector.boundingBox())?.width ?? 0), INSPECTOR_WIDTH)
  await page.getByRole('button', { name: 'Collapse Session inspector' }).click()
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Session inspector"]')?.getBoundingClientRect().width ===
      0,
  )
  assert.equal(Math.round((await inspector.boundingBox())?.width ?? 0), 0)
  await page.getByRole('button', { name: 'Open Session inspector' }).click()
  await page.waitForFunction(
    (inspectorWidth) =>
      Math.round(
        document.querySelector('[aria-label="Session inspector"]')?.getBoundingClientRect().width ??
          0,
      ) === inspectorWidth,
    INSPECTOR_WIDTH,
    { timeout: 10_000 },
  )
  assert.equal(Math.round((await inspector.boundingBox())?.width ?? 0), INSPECTOR_WIDTH)
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

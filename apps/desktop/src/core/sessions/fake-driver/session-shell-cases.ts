import assert from 'node:assert/strict'

// The shell comes before Session data. This proof reads the shipped route so its geometry and pane
// controls cannot be green because an old Roster or Feed happened to render.
export async function proveSessionShell(page) {
  await page.evaluate(() => {
    window.location.hash = '#/sessions'
  })
  await page.waitForSelector('[data-component="SessionShell"]')
  // The width the shipped token asks for, read off the page so a token change moves this proof too.
  const inspectorWidth = await page.evaluate(() =>
    Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--size-session-inspector'),
    ),
  )
  assert.ok(inspectorWidth > 0, '--size-session-inspector resolves to a width')

  const inspector = page.locator('aside[aria-label="Session inspector"]')
  if (Math.round((await inspector.boundingBox())?.width ?? 0) !== 0) {
    await page.getByRole('button', { name: 'Collapse Session inspector' }).click()
    await page.waitForFunction(
      () =>
        document.querySelector('[aria-label="Session inspector"]')?.getBoundingClientRect()
          .width === 0,
    )
  }
  assert.equal(Math.round((await inspector.boundingBox())?.width ?? 0), 0)
  await page.getByRole('button', { name: 'Open Session inspector' }).click()
  // Rounded like the assertion below: the settled width reads a fraction under the token on a
  // fractional device pixel ratio, so an exact comparison never becomes true.
  await page.waitForFunction(
    (width) =>
      Math.round(
        document.querySelector('[aria-label="Session inspector"]')?.getBoundingClientRect().width ??
          0,
      ) === width,
    inspectorWidth,
  )
  assert.equal(Math.round((await inspector.boundingBox())?.width ?? 0), inspectorWidth)
  await page.getByRole('button', { name: 'Collapse Session inspector' }).click()
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Session inspector"]')?.getBoundingClientRect().width ===
      0,
  )
  assert.equal(Math.round((await inspector.boundingBox())?.width ?? 0), 0)
}

import assert from 'node:assert/strict'

async function readRosterFacts(page) {
  return page
    .locator('nav[aria-label="Sessions"] button')
    .evaluateAll((rows) =>
      rows.map((row) => ({ id: row.getAttribute('data-session-id'), text: row.textContent })),
    )
}

async function proveRetiredSelection(page, restart) {
  await page.evaluate(() => window.localStorage.setItem('argo.selected-session-id', 'resumeChild'))
  const retired = await restart()
  await retired.waitForFunction(() => window.location.hash === '#/sessions/resumeParent')
  await retired.waitForSelector('.feed__viewport[data-session="resumeParent"] [data-feed-row]')
}

export async function provePackagedRosterSelection(page) {
  await page.evaluate(() => {
    window.location.hash = '#/sessions'
  })
  const first = page.locator('nav[aria-label="Sessions"] button').first()
  await first.waitFor()
  const sessionId = await first.getAttribute('data-session-id')
  assert.notEqual(sessionId, null)
  await first.focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction((id) => window.location.hash === `#/sessions/${id}`, sessionId)
  await page.waitForSelector(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
  const selected = page.locator(`nav[aria-label="Sessions"] button[data-session-id="${sessionId}"]`)
  assert.equal(await selected.getAttribute('aria-current'), 'page')
  await page.keyboard.press('ArrowDown')
  const focusedSessionId = await page.evaluate(
    () => document.activeElement?.getAttribute('data-session-id') ?? null,
  )
  assert.notEqual(focusedSessionId, sessionId)
  assert.equal(await selected.getAttribute('aria-current'), 'page')
}

export async function provePackagedRosterRestart(page, { remove, restart, updateRoster }) {
  await page.evaluate(() => {
    window.location.hash = '#/sessions'
  })
  const selected = page.locator('nav[aria-label="Sessions"] button[data-session-id="prose"]')
  await selected.waitFor()
  await selected.click()
  await page.waitForFunction(() => window.location.hash === '#/sessions/prose')
  await page.waitForSelector('.feed__viewport[data-session="prose"] [data-feed-row]')
  const rosterFacts = await readRosterFacts(page)

  const relaunched = await restart()
  await relaunched.waitForFunction(() => window.location.hash === '#/sessions/prose')
  await relaunched.waitForSelector('.feed__viewport[data-session="prose"] [data-feed-row]')
  assert.deepEqual(await readRosterFacts(relaunched), rosterFacts)
  assert.equal(
    await relaunched
      .locator('nav[aria-label="Sessions"] button[data-session-id="prose"]')
      .getAttribute('aria-current'),
    'page',
  )

  await updateRoster()
  const updated = await restart()
  await updated.waitForFunction(() => window.location.hash === '#/sessions/prose')
  await updated.waitForSelector('.feed__viewport[data-session="prose"] [data-feed-row]')
  assert.equal((await readRosterFacts(updated))[0]?.text?.includes('Run Codex check'), true)

  await updated.locator('summary').click()
  await updated.locator('nav[aria-label="Archived"] button').click()
  await updated.waitForFunction(() => window.location.hash === '#/sessions/plannedWork')
  const archived = await restart()
  await archived.waitForFunction(() => window.location.hash === '#/sessions/plannedWork')
  assert.equal(await archived.locator('details[open]').count(), 1)
  assert.equal(
    await archived
      .locator('nav[aria-label="Archived"] button[data-session-id="plannedWork"]')
      .getAttribute('aria-current'),
    'page',
  )

  await archived.locator('nav[aria-label="Sessions"] button[data-session-id="prose"]').click()
  await archived.waitForFunction(() => window.location.hash === '#/sessions/prose')
  await remove()
  const missing = await restart()
  await missing.waitForFunction(() => window.location.hash === '#/sessions')
  await missing.locator('nav[aria-label="Sessions"] button').first().waitFor()
  assert.equal(
    await missing.locator('nav[aria-label="Sessions"] button[aria-current="page"]').count(),
    0,
  )
  assert.equal(await missing.locator('.feed__viewport').count(), 0)

  await proveRetiredSelection(missing, restart)
}

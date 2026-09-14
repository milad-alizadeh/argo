import assert from 'node:assert/strict'

async function openSession(page, sessionId) {
  await page.evaluate((id) => {
    window.location.hash = `#/sessions/${id}`
  }, sessionId)
}

// A pending `AskUserQuestion` draws as a Feed row (#1840), and the composer stays a plain text
// box that simply cannot send while it waits — never becoming the answer UI itself.
//
// `askPending` is a static fixture with no owned adapter (the same shape as the `toolCalls`
// fixture `session-tool-calls-case.ts` reads), so answering it drives the real
// `decideSessionQuestion` IPC contract into a genuine `missing-session` failure — a real, visible
// failure path this layer can prove without teaching `fake-claude.ts` to emit and answer
// `AskUserQuestion` itself. The success path is proved live, PTY keys included, at the driver
// level (`claude-question-driver.test.ts`, `question-answer.test.ts`).
export async function proveSessionQuestion(page) {
  await openSession(page, 'askPending')
  const history = page.getByRole('region', { name: 'Session history' })
  await history.getByText('Which ink?').waitFor()
  await history.getByRole('radio', { name: /Black/ }).waitFor()
  await history.getByRole('radio', { name: /Blue/ }).waitFor()

  const message = page.locator('[aria-label="Message"]')
  await message.click()
  await page.keyboard.type('Not yet.')
  const send = page.locator('[aria-label="Send message"]')
  assert.equal(await send.isDisabled(), true)

  await history.getByRole('radio', { name: /Black/ }).click()
  await history.getByRole('button', { name: 'Send answer' }).click()
  await history.getByRole('alert').waitFor()
  await history.getByRole('radio', { name: /Black/ }).waitFor()
  assert.equal(await send.isDisabled(), true)
}

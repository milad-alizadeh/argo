import assert from 'node:assert/strict'
import { openSessionByClick } from './session-gestures'

// A pending `AskUserQuestion` draws as a Feed row (#1840), and the composer stays a plain text
// box that simply cannot send while it waits — never becoming the answer UI itself.
//
// `askPending` is a static fixture with no owned adapter (the same shape as the `toolCalls`
// fixture `session-tool-calls-case.ts` reads), so it reads as `external` posture: Argo holds no
// channel it could write an answer into, so the row draws locked rather than answerable (#2205).
// The answerable path is proved live, PTY keys included, at the driver level
// (`claude-question-driver.test.ts`, `question-answer.test.ts`).
export async function proveSessionQuestion(page) {
  await openSessionByClick(page, 'askPending')
  const history = page.getByRole('region', { name: 'Session history' })
  await history.getByText('Which ink?').waitFor()
  await history.getByText('This session is open in another app').waitFor()
  assert.equal(await history.getByRole('radio').count(), 0)
  assert.equal(await history.getByRole('button', { name: 'Send answer' }).count(), 0)

  const message = page.locator('[aria-label="Message"]')
  await message.click()
  await page.keyboard.type('Not yet.')
  const send = page.locator('[aria-label="Send message"]')
  assert.equal(await send.isDisabled(), true)
}

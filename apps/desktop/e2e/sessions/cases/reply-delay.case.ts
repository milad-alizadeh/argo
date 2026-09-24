// The packaged app shows its wait state and rejects repeated Sends while the Harness is silent (#2119).
// The backend decides what a reply looks like; this proof holds no reply string (#2308).
import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import { chooseHarness, openNewSessionByClick, sessionListIds } from '../gestures'
import type { SessionHarnessBackend } from '../session-harness-backend'

const WAITING_PROMPT = 'Reply with one short acknowledgement after this wait.'
const DUPLICATE_PROMPT = 'Reply with one short acknowledgement to this single request.'

type BeginRequest = { page: Page; backend: SessionHarnessBackend; prompt: string; sends: number }

async function send(page: Page, prompt: string, times: number) {
  const composer = page.getByRole('combobox', { name: 'Message' })
  await composer.click()
  await page.keyboard.type(prompt)
  for (let press = 0; press < times; press += 1) await page.keyboard.press('Enter')
}

async function begin({ page, backend, prompt, sends }: BeginRequest) {
  const known = await sessionListIds(page)
  await openNewSessionByClick(page)
  await chooseHarness(page, 'claude')
  await send(page, prompt, sends)
  const waiting = page.getByRole('status', { name: /Starting Session|Working/ })
  await waiting.waitFor()
  const reply = { harness: 'claude' as const, prompt }
  assert.equal(await backend.replied(page, reply), false)
  assert.equal(await backend.recorded(reply), false)
  return known
}

export async function proveReplyWait(page: Page, backend: SessionHarnessBackend) {
  const prompt = WAITING_PROMPT
  await begin({ page, backend, prompt, sends: 1 })
  await backend.waitForReply(page, { harness: 'claude', prompt })
}

export async function proveDuplicateSend(page: Page, backend: SessionHarnessBackend) {
  const prompt = DUPLICATE_PROMPT
  const known = await begin({ page, backend, prompt, sends: 5 })
  await backend.waitForReply(page, { harness: 'claude', prompt })
  const created = (await sessionListIds(page)).filter((id) => !known.includes(id))
  assert.equal(created.length, 1)
}

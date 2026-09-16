// The real packaged app must show its wait state and reject repeated Sends while the CLI is
// deliberately silent (#2119). What a reply looks like is the backend's answer, never a string
// held here (#2308).
import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import type { SessionCliBackend } from './session-cli-backend'
import { chooseHarness, openNewSessionByClick, rosterIds } from './session-gestures'

const WAITING_PROMPT = 'Reply with one short acknowledgement after this wait.'
const DUPLICATE_PROMPT = 'Reply with one short acknowledgement to this single request.'

type BeginRequest = { page: Page; backend: SessionCliBackend; prompt: string; sends: number }

async function send(page: Page, prompt: string, times: number) {
  const composer = page.getByRole('textbox', { name: 'Message' })
  await composer.click()
  await page.keyboard.type(prompt)
  for (let press = 0; press < times; press += 1) await page.keyboard.press('Enter')
}

async function begin({ page, backend, prompt, sends }: BeginRequest) {
  const known = await rosterIds(page)
  await openNewSessionByClick(page)
  await chooseHarness(page, 'claude')
  await send(page, prompt, sends)
  const waiting = page.getByRole('status', { name: /Starting Session|Working/ })
  await waiting.waitFor()
  const reply = { cli: 'claude' as const, prompt }
  assert.equal(await backend.replied(page, reply), false)
  assert.equal(await backend.recorded(reply), false)
  return known
}

export async function proveReplyWait(page: Page, backend: SessionCliBackend) {
  const prompt = WAITING_PROMPT
  await begin({ page, backend, prompt, sends: 1 })
  await backend.waitForReply(page, { cli: 'claude', prompt })
}

export async function proveDuplicateSend(page: Page, backend: SessionCliBackend) {
  const prompt = DUPLICATE_PROMPT
  const known = await begin({ page, backend, prompt, sends: 5 })
  await backend.waitForReply(page, { cli: 'claude', prompt })
  const created = (await rosterIds(page)).filter((id) => !known.includes(id))
  assert.equal(created.length, 1)
}

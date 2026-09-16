// The real packaged app must show its wait state and reject repeated Sends while the CLI is
// deliberately silent (#2119). What a reply looks like is the backend's answer, never a string
// held here (#2308).
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Page } from 'playwright-core'
import { mockClaudeFolder } from '../../../mocks/cli/claude/mock-claude-transcripts'
import type { SessionCliBackend } from '../../../mocks/sessions/session-cli-backend'
import { chooseHarness, openNewSessionByClick, rosterIds } from '../gestures'

const WAITING_PROMPT = 'Hold this reply while the packaged app waits.'
const DUPLICATE_PROMPT = 'Send this exactly once while the CLI waits.'

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

export async function proveDuplicateSend(
  page: Page,
  backend: SessionCliBackend,
  transcripts: string,
) {
  const prompt = DUPLICATE_PROMPT
  const known = await begin({ page, backend, prompt, sends: 5 })
  await backend.waitForReply(page, { cli: 'claude', prompt })
  const created = (await rosterIds(page)).filter((id) => !known.includes(id))
  assert.equal(created.length, 1)
  const transcript = await readFile(
    path.join(mockClaudeFolder(transcripts), `${created[0]}.jsonl`),
    'utf8',
  )
  const turns = transcript.split('\n').filter((line) => line.includes('"type":"user"'))
  assert.equal(turns.length, 1)
}

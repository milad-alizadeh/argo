// The real packaged app must show its wait state and reject repeated Sends while a fake CLI is
// deliberately silent (#2119). The only fake in these cases is the executable below the driver.
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Page } from 'playwright-core'
import { fakeClaudeFolder } from '../../../agents/claude/session-fake-driver/fake-claude-transcripts'
import { chooseHarness, openNewSessionByClick, rosterIds } from './session-gestures'

const WAITING_PROMPT = 'Hold this reply while the packaged app waits.'
const DUPLICATE_PROMPT = 'Send this exactly once while the fake CLI waits.'

type BeginRequest = { page: Page; transcripts: string; prompt: string; sends: number }

async function send(page: Page, prompt: string, times: number) {
  const composer = page.getByRole('textbox', { name: 'Message' })
  await composer.click()
  await page.keyboard.type(prompt)
  for (let press = 0; press < times; press += 1) await page.keyboard.press('Enter')
}

async function waitForReply(page: Page, prompt: string) {
  await page
    .getByRole('region', { name: 'Session history' })
    .getByText(`Fake Claude read: ${prompt}`)
    .waitFor()
}

async function fakeHasReplied(transcripts: string, prompt: string) {
  const folder = fakeClaudeFolder(transcripts)
  const files = await readdir(folder).catch(() => [])
  const records = await Promise.all(files.map((file) => readFile(path.join(folder, file), 'utf8')))
  return records.some((record) => record.includes(`Fake Claude read: ${prompt}`))
}

async function begin({ page, transcripts, prompt, sends }: BeginRequest) {
  const known = await rosterIds(page)
  await openNewSessionByClick(page)
  await chooseHarness(page, 'claude')
  await send(page, prompt, sends)
  const waiting = page.getByRole('status', { name: /Starting Session|Thinking/ })
  await waiting.waitFor()
  assert.equal(await page.getByText(`Fake Claude read: ${prompt}`).count(), 0)
  assert.equal(await fakeHasReplied(transcripts, prompt), false)
  return known
}

export async function proveReplyWait(page: Page, transcripts: string) {
  await begin({ page, transcripts, prompt: WAITING_PROMPT, sends: 1 })
  await waitForReply(page, WAITING_PROMPT)
}

export async function proveDuplicateSend(page: Page, transcripts: string) {
  const known = await begin({ page, transcripts, prompt: DUPLICATE_PROMPT, sends: 5 })
  await waitForReply(page, DUPLICATE_PROMPT)
  const created = (await rosterIds(page)).filter((id) => !known.includes(id))
  assert.equal(created.length, 1)
  const transcript = await readFile(
    path.join(fakeClaudeFolder(transcripts), `${created[0]}.jsonl`),
    'utf8',
  )
  const turns = transcript.split('\n').filter((line) => line.includes('"type":"user"'))
  assert.equal(turns.length, 1)
}

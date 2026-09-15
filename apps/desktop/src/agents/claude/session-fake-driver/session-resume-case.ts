// #2092 inside the SHIPPED app: a Claude Session Argo started is still in the Roster after a
// restart, its recorded Feed opens, and the next Turn resumes it into a new drive channel on the
// same resume-chain. A Session Argo never started resumes the same way: origin does not decide
// whether Argo can open a channel to a transcript it can read.
import assert from 'node:assert/strict'
import { chmod, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  fixturePath,
  replaceInFile,
} from '../../../core/sessions/fake-driver/session-fixture-files'
import {
  createSessionByClick,
  openSessionByClick,
} from '../../../core/sessions/fake-driver/session-gestures'
import { fakeClaudeFolder } from './fake-claude-transcripts'
import { rosterRow, waitFor } from './session-proof-helpers'

// The proof always starts in `apps/desktop`, as the fixture files note.
const FAKE_CLAUDE = path.join(
  process.cwd(),
  'src',
  'agents',
  'claude',
  'session-fake-driver',
  'fake-claude.ts',
)

// An executable `claude` the packaged app can spawn: this node, running the fake beside this file.
export async function writeFakeClaude(root, transcripts) {
  const executable = path.join(root, 'claude')
  await writeFile(
    executable,
    `#!/bin/sh\nexec "${process.execPath}" --no-warnings "${FAKE_CLAUDE}" "${transcripts}" "$@"\n`,
  )
  await chmod(executable, 0o755)
  return executable
}

async function sendFromComposer(page, text) {
  const composer = page.getByRole('textbox', { name: 'Message' })
  await composer.click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
  return composer
}

export async function provePackagedResume(page, { project, restart, transcripts }) {
  const sessionId = await createSessionByClick(page, {
    cli: 'claude',
    prompt: 'Open the resume proof.',
  })
  const transcript = path.join(fakeClaudeFolder(transcripts), `${sessionId}.jsonl`)
  await waitFor(async () => (await readFile(transcript, 'utf8').catch(() => '')).includes('Fake'))

  const relaunched = await restart()
  const [reread] = await rosterRow(relaunched, sessionId)
  assert.equal(reread?.posture, 'external')
  await openSessionByClick(relaunched, sessionId)
  await relaunched.waitForSelector(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
  const history = relaunched.getByRole('region', { name: 'Session history' })
  await history.getByText('Fake Claude read: Open the resume proof.').waitFor()

  await sendFromComposer(relaunched, 'Carry on after the restart.')
  await history.getByText('Fake Claude read: Carry on after the restart.').waitFor()
  await relaunched.getByRole('button', { name: 'Compact context' }).click()
  await waitForCompactionFeed(relaunched, sessionId)
  await history.getByText('Conversation compacted').waitFor()
  const resumed = await rosterRow(relaunched, sessionId)
  assert.deepEqual(
    resumed.map(({ posture }) => posture),
    ['managed'],
  )

  // externalBasic's fixture cwd (`/Users/x/proj`) is a display-only fake path; a real send
  // resumes a real process, so it needs a directory that exists on this machine.
  await replaceInFile(fixturePath(transcripts, 'externalBasic'), '/Users/x/proj', project)

  await openSessionByClick(relaunched, 'externalBasic')
  await relaunched.waitForSelector('.feed__viewport[data-session="externalBasic"] [data-feed-row]')
  await sendFromComposer(relaunched, 'Take this one over.')
  const externalHistory = relaunched.getByRole('region', { name: 'Session history' })
  await externalHistory
    .getByText('Fake Claude read: Take this one over.')
    .waitFor()
    .catch((error) => reportStalledResume(relaunched, transcripts, error))
  return relaunched
}

// A refused resume (`held-elsewhere`, or any other Turn failure) swaps the composer for an Alert
// rather than throwing here, so the plain timeout above names nothing useful. An empty alert list
// still leaves open whether the Turn was ever delivered, whether the resumed process ever wrote
// back, or whether the Roster read the write it made, so this reports all three.
async function reportStalledResume(page, transcripts, error) {
  const alerted = await page.locator('[role="alert"]').allTextContents()
  const feedRows = await page
    .locator('.feed__viewport[data-session="externalBasic"] [data-feed-row]')
    .allTextContents()
  const [row] = await rosterRow(page, 'externalBasic')
  const written = await readFile(
    path.join(transcripts, 'fake-claude', 'externalBasic.jsonl'),
    'utf8',
  ).catch((readError) => `<unreadable: ${readError.message}>`)
  throw new Error(
    `${error.message}\nRendered alert(s): ${JSON.stringify(alerted)}\nFeed rows: ${JSON.stringify(feedRows)}\nRoster row: ${JSON.stringify(row)}\nfake-claude/externalBasic.jsonl: ${written}`,
  )
}

async function waitForCompactionFeed(page, sessionId) {
  await waitFor(async () => {
    const [session] = await rosterRow(page, sessionId)
    return session?.compactionStartedAt !== null
  }, 60_000)
  await waitFor(async () => {
    const rows = await page
      .locator(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
      .allTextContents()
    return rows.some((row) => row.includes('Conversation compacted'))
  }, 60_000)
}

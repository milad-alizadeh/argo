// #2092 inside the SHIPPED app: a Claude Session Argo started is still in the Roster after a
// restart, its recorded Feed opens, and the next Turn resumes it into a new drive channel on the
// same resume-chain. A Session Argo never started resumes the same way: origin does not decide
// whether Argo can open a channel to a transcript it can read.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fixturePath, proofCwd, replaceInFile } from '../../../mocks/sessions/mock-transcript-files'
import { rosterRow, waitFor } from '../claude-proof-helpers'
import { createSessionByClick, openSessionByClick } from '../gestures'

async function sendFromComposer(page, text) {
  const composer = page.getByRole('textbox', { name: 'Message' })
  await composer.click()
  await page.keyboard.type(text)
  await page.getByRole('button', { name: 'Send message' }).click()
  return composer
}

export async function provePackagedResume(page, { backend, project, restart, transcripts }) {
  const opened = { cli: 'claude', prompt: 'Open the resume proof.' }
  const sessionId = await createSessionByClick(page, { cli: 'claude', prompt: opened.prompt })
  await waitFor(() => backend.recorded(opened))

  const relaunched = await restart()
  const [reread] = await rosterRow(relaunched, sessionId)
  assert.equal(reread?.posture, 'external')
  await openSessionByClick(relaunched, sessionId)
  await relaunched.waitForSelector(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
  const history = relaunched.getByRole('region', { name: 'Session history' })
  await backend.waitForReply(relaunched, opened)

  await sendFromComposer(relaunched, 'Carry on after the restart.')
  await backend
    .waitForReply(relaunched, { cli: 'claude', prompt: 'Carry on after the restart.' })
    .catch((error) => reportStalledResume({ error, page: relaunched, sessionId, transcripts }))
  await relaunched.getByRole('button', { name: 'Compact context' }).click()
  await waitForCompactionFeed(relaunched, sessionId)
  await history.getByText('Conversation compacted').waitFor()
  const resumed = await rosterRow(relaunched, sessionId)
  assert.deepEqual(
    resumed.map(({ posture }) => posture),
    ['managed'],
  )

  // externalBasic's fixture cwd is a folder under the Project that no one created; a real send
  // resumes a real process, so it needs a directory that exists on this machine.
  await replaceInFile(
    fixturePath(transcripts, 'externalBasic'),
    proofCwd(transcripts, 'proj'),
    project,
  )

  await openSessionByClick(relaunched, 'externalBasic')
  await relaunched.waitForSelector('.feed__viewport[data-session="externalBasic"] [data-feed-row]')
  await sendFromComposer(relaunched, 'Take this one over.')
  await backend
    .waitForReply(relaunched, { cli: 'claude', prompt: 'Take this one over.' })
    .catch((error) =>
      reportStalledResume({ error, page: relaunched, sessionId: 'externalBasic', transcripts }),
    )
  return relaunched
}

// A refused resume (`held-elsewhere`, or any other Turn failure) swaps the composer for an Alert
// rather than throwing here, so the plain timeout above names nothing useful. An empty alert list
// still leaves open whether the Turn was ever delivered, whether the resumed process ever wrote
// back, or whether the Roster read the write it made, so this reports all three.
async function reportStalledResume({ error, page, sessionId, transcripts }) {
  const alerted = await page.locator('[role="alert"]').allTextContents()
  const feedRows = await page
    .locator(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
    .allTextContents()
  const [row] = await rosterRow(page, sessionId)
  const written = await readFile(
    path.join(transcripts, 'mock-claude', `${sessionId}.jsonl`),
    'utf8',
  ).catch((readError) => `<unreadable: ${readError.message}>`)
  throw new Error(
    `${error.message}\nRendered alert(s): ${JSON.stringify(alerted)}\nFeed rows: ${JSON.stringify(feedRows)}\nRoster row: ${JSON.stringify(row)}\nmock-claude/${sessionId}.jsonl: ${written}`,
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

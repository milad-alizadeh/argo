// #1842 inside the SHIPPED app: a Claude Session Argo started is still in the Roster after a
// restart, its recorded Feed opens, and the next Turn resumes it into a new drive channel on the
// same resume-chain. A Session Argo never started refuses the Turn with its reason, draft kept.
import assert from 'node:assert/strict'
import { chmod, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

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

async function rosterRow(page, sessionId) {
  const reply = await page.evaluate(() => window.argo.listSessions())
  assert.equal(reply.type, 'session.listed')
  return reply.sessions.filter((session) => session.id === sessionId)
}

async function sendFromComposer(page, text) {
  const composer = page.getByRole('textbox', { name: 'Message' })
  await composer.click()
  await page.keyboard.type(text)
  await page.keyboard.press('Shift+Enter')
  return composer
}

export async function provePackagedResume(page, { project, restart, transcripts }) {
  const started = await page.evaluate(
    (cwd) =>
      window.argo.startClaudeSession({
        cwd,
        prompt: 'Open the resume proof.',
        setup: { model: 'opus', effort: 'medium', mode: 'manual' },
      }),
    project,
  )
  assert.equal(started.type, 'session.claude.started')
  const sessionId = started.sessionId
  const transcript = path.join(transcripts, 'fake-claude', `${sessionId}.jsonl`)
  await page.waitForFunction(
    async (id) => (await window.argo.listSessions()).sessions?.some((row) => row.id === id),
    sessionId,
  )
  await waitFor(async () => (await readFile(transcript, 'utf8').catch(() => '')).includes('Fake'))

  const relaunched = await restart()
  const [orphaned] = await rosterRow(relaunched, sessionId)
  assert.equal(orphaned?.posture, 'orphaned')
  await relaunched
    .locator(`nav[aria-label="Sessions"] button[data-session-id="${sessionId}"]`)
    .click()
  await relaunched.waitForSelector(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
  const history = relaunched.getByRole('region', { name: 'Session history' })
  await history.getByText('Fake Claude read: Open the resume proof.').waitFor()

  await sendFromComposer(relaunched, 'Carry on after the restart.')
  await history.getByText('Fake Claude read: Carry on after the restart.').waitFor()
  await relaunched.getByRole('button', { name: 'Compact context' }).click()
  const status = relaunched.locator(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`)
  await waitFor(async () => {
    const rows = await status.allTextContents()
    return rows.some((row) => row.includes('Compacting conversation'))
  }, 30_000)
  await waitFor(async () => {
    const rows = await status.allTextContents()
    return rows.some((row) => row.includes('Conversation compacted'))
  }, 30_000)
  await history.getByText('Conversation compacted').waitFor()
  const resumed = await rosterRow(relaunched, sessionId)
  assert.deepEqual(
    resumed.map(({ posture }) => posture),
    ['managed'],
  )

  await relaunched
    .locator('nav[aria-label="Sessions"] button[data-session-id="externalBasic"]')
    .click()
  await relaunched.waitForSelector('.feed__viewport[data-session="externalBasic"] [data-feed-row]')
  const composer = await sendFromComposer(relaunched, 'Take this one over.')
  await relaunched
    .getByRole('alert')
    .filter({ hasText: 'Argo did not start this Claude Session, so it cannot send to it.' })
    .waitFor()
  assert.equal(await composer.textContent(), 'Take this one over.')
  return relaunched
}

async function waitFor(condition, timeout = 10_000) {
  const deadline = Date.now() + timeout
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error('The fake claude never wrote its transcript.')
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

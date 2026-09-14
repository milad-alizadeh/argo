// #2134: connecting a Ticket renames the Session through the same `session.rename` path a person's
// manual rename takes. Proved against the packaged app and the real fake `claude` process, so the
// bracketed-paste `/rename` command and the `custom-title` record it writes are both exercised —
// never a stub standing in for the CLI's own read-back.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

async function rosterRow(page, sessionId) {
  const reply = await page.evaluate(() => window.argo.listSessions())
  assert.equal(reply.type, 'session.listed')
  return reply.sessions.filter((session) => session.id === sessionId)
}

async function waitFor(condition, timeout = 10_000) {
  const deadline = Date.now() + timeout
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error('The fake claude never wrote its transcript.')
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

export async function proveClaudeRename(page, { project, transcripts }) {
  const started = await page.evaluate(
    (cwd) =>
      window.argo.startSession({
        cli: 'claude',
        cwd,
        prompt: 'Open the rename proof.',
        setup: { model: 'opus', effort: 'medium', mode: 'manual' },
      }),
    project,
  )
  assert.equal(started.type, 'session.started')
  const sessionId = started.sessionId
  const transcript = path.join(transcripts, 'fake-claude', `${sessionId}.jsonl`)
  await waitFor(async () => (await readFile(transcript, 'utf8').catch(() => '')).includes('Fake'))

  const [beforeRename] = await rosterRow(page, sessionId)
  assert.deepEqual(beforeRename?.title, {
    text: 'Open the rename proof.',
    source: 'first-prompt',
  })

  const renamed = await page.evaluate(
    (id) => window.argo.renameSession({ sessionId: id, name: 'Ticket: fix the roster badge' }),
    sessionId,
  )
  assert.equal(renamed.type, 'session.renamed')

  await waitFor(async () =>
    (await readFile(transcript, 'utf8')).includes('"customTitle":"Ticket: fix the roster badge"'),
  )
  await page.waitForFunction(async (id) => {
    const reply = await window.argo.listSessions()
    const sessions = reply.type === 'session.listed' ? reply.sessions : []
    const [row] = sessions.filter((session) => session.id === id)
    return row?.title?.source === 'custom'
  }, sessionId)
  const [afterRename] = await rosterRow(page, sessionId)
  assert.deepEqual(afterRename?.title, { text: 'Ticket: fix the roster badge', source: 'custom' })
}

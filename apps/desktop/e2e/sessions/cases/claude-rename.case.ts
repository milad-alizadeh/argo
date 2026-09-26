// #2134: connecting a Ticket renames the Session through the same `session.rename` path a person's
// manual rename takes. Proved against the packaged app and the real mock `claude` process, so the
// bracketed-paste `/rename` command and the `custom-title` record it writes are both exercised —
// never a stub standing in for the Harness's own read-back.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { rosterRow, waitFor } from '../claude-proof-helpers'

export async function proveClaudeRename(page, { backend, project, transcripts }) {
  const prompt = 'Open the rename proof.'
  const started = await page.evaluate(
    ({ cwd, prompt }) =>
      window.argo.startSession({
        harness: 'claude',
        cwd,
        prompt,
        turnConfiguration: { model: 'opus', effort: 'medium', mode: 'manual' },
      }),
    { cwd: project, prompt },
  )
  assert.equal(started.type, 'session.started')
  const sessionId = started.sessionId
  const transcript = path.join(transcripts, 'mock-claude', `${sessionId}.jsonl`)
  await waitFor(() => backend.recorded({ harness: 'claude', prompt }))

  const [beforeRename] = await rosterRow(page, sessionId)
  assert.deepEqual(beforeRename?.title, { text: prompt, source: 'first-prompt' })

  const renamed = await page.evaluate(
    (id) => window.argo.renameSession({ sessionId: id, name: 'Ticket: fix the roster badge' }),
    sessionId,
  )
  assert.equal(renamed.type, 'session.renamed')

  await waitFor(async () =>
    (await readFile(transcript, 'utf8')).includes('"customTitle":"Ticket: fix the roster badge"'),
  )
  await page.waitForFunction(async (id) => {
    const reply = await window.argo.listSessions({ projectRoot: null })
    const sessions = reply.type === 'session.listed' ? reply.sessions : []
    const [row] = sessions.filter((session) => session.id === id)
    return row?.title?.source === 'custom'
  }, sessionId)
  const [afterRename] = await rosterRow(page, sessionId)
  assert.deepEqual(afterRename?.title, { text: 'Ticket: fix the roster badge', source: 'custom' })
}

import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { chooseAttachments, statAttachments } from './attachments'

async function tempDirectory(context: { after: (fn: () => unknown) => void }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-attachments-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  return directory
}

test('chooseAttachments hands back the paths the chooser returned', async () => {
  const reply = await chooseAttachments(
    { version: 1, type: 'session.attachments.choose', requestId: 'r1' },
    { chooseFiles: async () => ['/repo/notes.md', '/repo/workspace.jpg'] },
  )
  assert.deepEqual(reply, {
    version: 1,
    type: 'session.attachments.chosen',
    requestId: 'r1',
    paths: ['/repo/notes.md', '/repo/workspace.jpg'],
  })
})

test('chooseAttachments hands back no paths when the chooser was dismissed', async () => {
  const reply = await chooseAttachments(
    { version: 1, type: 'session.attachments.choose', requestId: 'r2' },
    { chooseFiles: async () => [] },
  )
  assert.deepEqual(reply.type === 'session.attachments.chosen' ? reply.paths : null, [])
})

test('statAttachments reports a real file as readable and a missing one as not', async (context) => {
  const directory = await tempDirectory(context)
  const real = path.join(directory, 'notes.md')
  await writeFile(real, 'notes')
  const missing = path.join(directory, 'gone.md')

  const reply = await statAttachments({
    version: 1,
    type: 'session.attachments.stat',
    requestId: 'r3',
    paths: [real, missing],
  })

  assert.deepEqual(reply, {
    version: 1,
    type: 'session.attachments.statted',
    requestId: 'r3',
    files: [
      { path: real, readable: true },
      { path: missing, readable: false },
    ],
  })
})

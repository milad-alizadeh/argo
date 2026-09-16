import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { legacyArchivedSessionIds } from './legacy-archive'

test('reads archived CLI Session ids from the Claude desktop store', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-legacy-archive-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const directory = path.join(root, 'workspace', 'project')
  await mkdir(directory, { recursive: true })
  await writeFile(
    path.join(directory, 'archived.json'),
    JSON.stringify({ cliSessionId: 'archived-session', isArchived: true }),
  )
  await writeFile(
    path.join(directory, 'active.json'),
    JSON.stringify({ cliSessionId: 'active-session', isArchived: false }),
  )

  assert.deepEqual([...(await legacyArchivedSessionIds(root))], ['archived-session'])
})

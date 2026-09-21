import { Database } from 'bun:sqlite'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createProjectStore } from '@/domains/projects/main/sqlite-store'
import { createProjectSetupRegistry } from './project-setup-registry'

test('restores the exact ready manual setup after a restart', async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-project-setup-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const databasePath = path.join(directory, 'argo.sqlite')
  const source =
    '{"version":1,"targets":{"desktop":{"default":true,"path":"apps/desktop","setup":"bun install","run":"bun run dev","build":"bun run build","test":"bun test"}}}'
  const first = setupStore(databasePath)
  const setup = createProjectSetupRegistry(first)
  setup.command({
    commandId: 'manual',
    event: { type: 'CHOOSE_MANUAL' },
    expectedRevision: 0,
    projectId: 'project-1',
  })
  setup.command({
    commandId: 'save',
    event: { type: 'SAVE_MANUAL', source },
    expectedRevision: 1,
    projectId: 'project-1',
  })
  first.close()
  const reopened = createProjectSetupRegistry(setupStore(databasePath))
  assert.deepEqual(reopened.snapshot('project-1'), {
    projectId: 'project-1',
    revision: 2,
    screen: 'ready',
    manualSource: source,
  })
})

function setupStore(databasePath: string) {
  const database = new Database(databasePath)
  return createProjectStore(database)
}

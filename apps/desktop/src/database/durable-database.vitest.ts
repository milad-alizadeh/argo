import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'
import { project } from '@/database/project/schema'
import { createDurableDatabase } from './durable-database'
import { databaseMigrationsFolder } from './migrations-folder'
import { openSharedDatabase } from './shared-database'

test('pinned node-sqlite adapter reads and writes a migrated durable table', async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'argo-drizzle-contract-'))
  try {
    const client = openSharedDatabase(userData, databaseMigrationsFolder())
    const database = createDurableDatabase(client)
    database
      .insert(project)
      .values({ id: 'project-1', path: '/repo', commonDirectory: '/repo/.git' })
      .run()
    assert.deepEqual(database.select().from(project).get(), {
      id: 'project-1',
      path: '/repo',
      commonDirectory: '/repo/.git',
    })
    client.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'vitest'
import { project } from '@/database/project/schema'
import { databaseMigrationsFolder, openDatabase } from './database'

test('development migrations come from the worktree Drizzle directory', () => {
  expect(databaseMigrationsFolder()).toBe(path.resolve(process.cwd(), 'drizzle'))
})

test('the node-sqlite database reads and writes a migrated table', async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'argo-drizzle-contract-'))
  try {
    const database = openDatabase(userData)
    database
      .insert(project)
      .values({ id: 'project-1', path: '/repo', commonDirectory: '/repo/.git' })
      .run()
    assert.deepEqual(
      database
        .select({ id: project.id, path: project.path, commonDirectory: project.commonDirectory })
        .from(project)
        .get(),
      {
        id: 'project-1',
        path: '/repo',
        commonDirectory: '/repo/.git',
      },
    )
    database.$client.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})

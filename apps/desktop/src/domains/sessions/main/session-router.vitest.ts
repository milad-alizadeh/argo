import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { project, projectSelection } from '@/domains/projects/main/schema'
import { session } from '@/domains/sessions/next/main/schema'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { databaseMigrationsFolder } from '@/platform/main/storage/migrations-folder'
import { openSharedDatabase } from '@/platform/main/storage/shared-database'
import { appRouter } from '@/platform/main/trpc-router'

const folders: string[] = []

function seedSessionListDatabase(database: ReturnType<typeof createDurableDatabase>): void {
  database
    .insert(project)
    .values([
      { id: 'project-1', path: '/tmp/project-1', commonDirectory: '/tmp/project-1/.git' },
      { id: 'project-2', path: '/tmp/project-2', commonDirectory: '/tmp/project-2/.git' },
    ])
    .run()
  database.insert(projectSelection).values({ singleton: 1, projectId: 'project-1' }).run()
  database
    .insert(session)
    .values([
      {
        argoId: 'argo-session-old',
        projectId: 'project-1',
        harness: 'claude',
        nativeId: 'native-old',
        title: 'Older Session',
        firstPrompt: 'Hello',
        updatedAt: 1,
      },
      {
        argoId: 'argo-session-new',
        projectId: 'project-1',
        harness: 'claude',
        nativeId: 'native-new',
        title: 'Newer Session',
        firstPrompt: 'Hello again',
        updatedAt: 2,
      },
      {
        argoId: 'argo-session-other-project',
        projectId: 'project-2',
        harness: 'claude',
        nativeId: 'native-other',
        title: 'Other Project Session',
        firstPrompt: 'Hidden',
        updatedAt: 3,
      },
    ])
    .run()
}

afterEach(async () => {
  await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })))
})

test('reads a typed Session page from SQLite through the domain router', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-session-router-'))
  folders.push(folder)
  const client = openSharedDatabase(folder, databaseMigrationsFolder())
  const database = createDurableDatabase(client)
  seedSessionListDatabase(database)

  try {
    await expect(
      appRouter.createCaller({ database }).sessions.list({ page: 1, pageSize: 1 }),
    ).resolves.toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      items: [
        {
          argoId: 'argo-session-new',
          harness: 'claude',
          nativeId: 'native-new',
          title: 'Newer Session',
        },
      ],
    })
    await expect(
      appRouter.createCaller({ database }).sessions.list({ page: 2, pageSize: 1 }),
    ).resolves.toEqual({
      page: 2,
      pageSize: 1,
      total: 2,
      items: [
        {
          argoId: 'argo-session-old',
          harness: 'claude',
          nativeId: 'native-old',
          title: 'Older Session',
        },
      ],
    })
  } finally {
    client.close()
  }
})

test('rejects malformed Session input and output at the tRPC boundary', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-session-router-invalid-'))
  folders.push(folder)
  const client = openSharedDatabase(folder, databaseMigrationsFolder())
  const database = createDurableDatabase(client)
  database
    .insert(project)
    .values({ id: 'project-1', path: '/tmp/project-1', commonDirectory: '/tmp/project-1/.git' })
    .run()
  database.insert(projectSelection).values({ singleton: 1, projectId: 'project-1' }).run()
  database
    .insert(session)
    .values({
      argoId: 'argo-session-2',
      projectId: 'project-1',
      harness: 'foreign',
      nativeId: 'native-2',
      title: null,
      firstPrompt: null,
      updatedAt: 1,
    })
    .run()

  try {
    await expect(
      appRouter.createCaller({ database }).sessions.list({ page: 0, pageSize: 20 }),
    ).rejects.toThrow()
    await expect(
      appRouter.createCaller({ database }).sessions.list({ page: 1, pageSize: 20 }),
    ).rejects.toThrow()
  } finally {
    client.close()
  }
})

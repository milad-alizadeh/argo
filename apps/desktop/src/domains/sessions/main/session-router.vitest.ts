import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { session } from '@/domains/sessions/next/main/schema'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { databaseMigrationsFolder } from '@/platform/main/storage/migrations-folder'
import { openSharedDatabase } from '@/platform/main/storage/shared-database'
import { appRouter } from '@/platform/main/trpc-router'

const folders: string[] = []

function seedSessionListDatabase(
  database: ReturnType<typeof createDurableDatabase>,
  client: import('node:sqlite').DatabaseSync,
): void {
  client.exec(
    "INSERT INTO project (id, path, common_directory) VALUES ('project-1', '/tmp/project-1', '/tmp/project-1/.git'), ('project-2', '/tmp/project-2', '/tmp/project-2/.git')",
  )
  client.exec("INSERT INTO project_selection (singleton, project_id) VALUES (1, 'project-1')")
  database
    .insert(session)
    .values([
      {
        argoId: '00000000-0000-4000-8000-000000000001',
        projectId: 'project-1',
        harness: 'claude',
        nativeId: 'native-old',
        title: 'Older Session',
        firstPrompt: 'Hello',
        updatedAt: 1,
      },
      {
        argoId: '00000000-0000-4000-8000-000000000002',
        projectId: 'project-1',
        harness: 'claude',
        nativeId: 'native-new',
        title: 'Newer Session',
        firstPrompt: 'Hello again',
        updatedAt: 2,
      },
      {
        argoId: '00000000-0000-4000-8000-000000000003',
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
  seedSessionListDatabase(database, client)

  try {
    await expect(
      appRouter
        .createCaller({ database, selectedProjectId: () => 'project-1' })
        .sessions.list({ page: 1, pageSize: 1 }),
    ).resolves.toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      items: [
        {
          argoId: '00000000-0000-4000-8000-000000000002',
          harness: 'claude',
          title: 'Newer Session',
        },
      ],
    })
    await expect(
      appRouter
        .createCaller({ database, selectedProjectId: () => 'project-1' })
        .sessions.list({ page: 2, pageSize: 1 }),
    ).resolves.toEqual({
      page: 2,
      pageSize: 1,
      total: 2,
      items: [
        {
          argoId: '00000000-0000-4000-8000-000000000001',
          harness: 'claude',
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
  client.exec(
    "INSERT INTO project (id, path, common_directory) VALUES ('project-1', '/tmp/project-1', '/tmp/project-1/.git')",
  )
  client.exec("INSERT INTO project_selection (singleton, project_id) VALUES (1, 'project-1')")
  database
    .insert(session)
    .values({
      argoId: '00000000-0000-4000-8000-000000000004',
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
      appRouter
        .createCaller({ database, selectedProjectId: () => 'project-1' })
        .sessions.list({ page: 0, pageSize: 20 }),
    ).rejects.toThrow()
    await expect(
      appRouter
        .createCaller({ database, selectedProjectId: () => 'project-1' })
        .sessions.list({ page: 1, pageSize: 20 }),
    ).rejects.toThrow()
  } finally {
    client.close()
  }
})

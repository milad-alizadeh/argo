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

afterEach(async () => {
  await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })))
})

test('reads a typed Session page from SQLite through the domain router', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-session-router-'))
  folders.push(folder)
  const client = openSharedDatabase(folder, databaseMigrationsFolder())
  const database = createDurableDatabase(client)
  database
    .insert(session)
    .values({
      argoId: 'argo-session-1',
      harness: 'claude',
      nativeId: 'native-1',
      title: 'SQLite Session',
      firstPrompt: 'Hello',
      updatedAt: 1,
    })
    .run()

  try {
    await expect(
      appRouter.createCaller({ database }).sessions.page({ page: 1, pageSize: 20 }),
    ).resolves.toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      items: [
        {
          argoId: 'argo-session-1',
          harness: 'claude',
          nativeId: 'native-1',
          title: 'SQLite Session',
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
    .insert(session)
    .values({
      argoId: 'argo-session-2',
      harness: 'foreign',
      nativeId: 'native-2',
      title: null,
      firstPrompt: null,
      updatedAt: 1,
    })
    .run()

  try {
    await expect(
      appRouter.createCaller({ database }).sessions.page({ page: 0, pageSize: 20 }),
    ).rejects.toThrow()
    await expect(
      appRouter.createCaller({ database }).sessions.page({ page: 1, pageSize: 20 }),
    ).rejects.toThrow()
  } finally {
    client.close()
  }
})

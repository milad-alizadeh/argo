import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { type Database, databaseMigrationsFolder, openDatabase } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { type AppRouterDependencies, createAppRouter } from './trpc-router'

let userData: string
let database: Database

beforeEach(async () => {
  userData = await mkdtemp(path.join(os.tmpdir(), 'argo-session-router-'))
  database = openDatabase(userData, { migrationsFolder: databaseMigrationsFolder() })
})

afterEach(async () => {
  database.$client.close()
  await rm(userData, { recursive: true, force: true })
})

test('registers the paged Session list under sessions.list', async () => {
  database
    .insert(sessionTable)
    .values({
      argoId: '00000000-0000-4000-8000-000000000001',
      harness: 'claude',
      nativeId: 'native-1',
      firstPrompt: 'Open the saved Session',
    })
    .run()
  const dependencies = {
    accounts: {},
    catalog: {},
    harnessSignIn: {},
    projects: { database },
    sessions: { database, supervisor: { send: () => {} } },
    tickets: {},
    workspaces: { database },
  } as unknown as AppRouterDependencies

  await expect(
    createAppRouter(dependencies).createCaller({}).sessions.list({ page: 1, pageSize: 30 }),
  ).resolves.toMatchObject({
    page: 1,
    pageSize: 30,
    total: 1,
    rows: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        harness: 'claude',
        title: { text: 'Open the saved Session', source: 'first-prompt' },
      },
    ],
  })
})

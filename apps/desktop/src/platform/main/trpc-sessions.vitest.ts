import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { type Database, databaseMigrationsFolder, openDatabase } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { saveSessionBatch } from '@/domains/sessions/main/sync/session-sync-records'
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

test('registers the paged Session list on the global router', async () => {
  database
    .insert(project)
    .values({ id: 'project-1', path: '/work/one', commonDirectory: '/work/one/.git' })
    .run()
  database
    .insert(sessionTable)
    .values({
      argoId: '00000000-0000-4000-8000-000000000001',
      harness: 'claude',
      nativeId: 'native-1',
      projectId: 'project-1',
      firstPrompt: 'Open the saved Session',
    })
    .run()
  const dependencies = {
    accounts: {},
    catalog: {},
    harnessSignIn: {},
    projects: { database },
    sessions: {
      database,
      supervisor: { getSnapshot: () => ({ context: { sessions: {} } }), send: () => {} },
    },
    tickets: {},
    workspaces: { database },
  } as unknown as AppRouterDependencies

  await expect(
    createAppRouter(dependencies)
      .createCaller({})
      .sessionList({ projectId: 'project-1', page: 1, pageSize: 30 }),
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

test('renames a saved Session through sessionRename after the Harness accepts it', async () => {
  database
    .insert(sessionTable)
    .values({
      argoId: '00000000-0000-4000-8000-000000000002',
      harness: 'claude',
      nativeId: 'native-rename',
      customTitle: 'Before',
    })
    .run()
  const renamed: unknown[] = []
  const dependencies = {
    accounts: {},
    catalog: {},
    harnessSignIn: {},
    projects: { database },
    sessions: {
      database,
      rename: async (request: unknown) => {
        renamed.push(request)
      },
      supervisor: { getSnapshot: () => ({ context: { sessions: {} } }), send: () => {} },
    },
    tickets: {},
    workspaces: { database },
  } as unknown as AppRouterDependencies

  await expect(
    createAppRouter(dependencies).createCaller({}).sessionRename({
      sessionId: '00000000-0000-4000-8000-000000000002',
      title: 'Confirmed title',
    }),
  ).resolves.toEqual({ title: 'Confirmed title' })
  expect(renamed).toEqual([
    {
      harness: 'claude',
      nativeId: 'native-rename',
      title: 'Confirmed title',
    },
  ])
  expect(
    database
      .select({ customTitle: sessionTable.customTitle })
      .from(sessionTable)
      .where(eq(sessionTable.argoId, '00000000-0000-4000-8000-000000000002'))
      .get(),
  ).toEqual({ customTitle: 'Confirmed title' })
})

test('keeps the existing title when the Harness rejects a rename', async () => {
  database
    .insert(sessionTable)
    .values({
      argoId: '00000000-0000-4000-8000-000000000003',
      harness: 'claude',
      nativeId: 'native-rejected-rename',
      customTitle: 'Before',
    })
    .run()
  const dependencies = {
    accounts: {},
    catalog: {},
    harnessSignIn: {},
    projects: { database },
    sessions: {
      database,
      rename: async () => {
        throw new Error('Harness rejected the rename.')
      },
      supervisor: { getSnapshot: () => ({ context: { sessions: {} } }), send: () => {} },
    },
    tickets: {},
    workspaces: { database },
  } as unknown as AppRouterDependencies

  await expect(
    createAppRouter(dependencies).createCaller({}).sessionRename({
      sessionId: '00000000-0000-4000-8000-000000000003',
      title: 'Rejected title',
    }),
  ).rejects.toThrow('Harness rejected the rename.')
  expect(
    database
      .select({ customTitle: sessionTable.customTitle })
      .from(sessionTable)
      .where(eq(sessionTable.argoId, '00000000-0000-4000-8000-000000000003'))
      .get(),
  ).toEqual({ customTitle: 'Before' })
})

test('accepts a later Harness sync that changes or clears a confirmed custom title', async () => {
  database
    .insert(sessionTable)
    .values({
      argoId: '00000000-0000-4000-8000-000000000004',
      harness: 'claude',
      nativeId: 'native-synced-rename',
    })
    .run()
  const dependencies = {
    accounts: {},
    catalog: {},
    harnessSignIn: {},
    projects: { database },
    sessions: {
      database,
      rename: async () => undefined,
      supervisor: { getSnapshot: () => ({ context: { sessions: {} } }), send: () => {} },
    },
    tickets: {},
    workspaces: { database },
  } as unknown as AppRouterDependencies
  const caller = createAppRouter(dependencies).createCaller({})

  await caller.sessionRename({
    sessionId: '00000000-0000-4000-8000-000000000004',
    title: 'Confirmed title',
  })
  saveSessionBatch(database, 'claude', [
    { nativeId: 'native-synced-rename', customTitle: 'Changed by the Harness' },
  ])
  expect(
    database
      .select({ customTitle: sessionTable.customTitle })
      .from(sessionTable)
      .where(eq(sessionTable.argoId, '00000000-0000-4000-8000-000000000004'))
      .get(),
  ).toEqual({ customTitle: 'Changed by the Harness' })

  saveSessionBatch(database, 'claude', [{ nativeId: 'native-synced-rename', customTitle: null }])
  expect(
    database
      .select({ customTitle: sessionTable.customTitle })
      .from(sessionTable)
      .where(eq(sessionTable.argoId, '00000000-0000-4000-8000-000000000004'))
      .get(),
  ).toEqual({ customTitle: null })
})

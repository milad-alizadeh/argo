import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { inferRouterOutputs } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { type Database, databaseMigrationsFolder, openDatabase } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { SessionRosterChanges } from '@/domains/sessions/main/api/session-roster-changes'
import { refreshSessionSubagents } from '@/domains/sessions/main/database/session-subagents'
import { saveSessionBatch } from '@/domains/sessions/main/sync/session-sync-records'
import { type AppRouter, type AppRouterDependencies, createAppRouter } from './trpc-router'

let userData: string
let database: Database

function routerDependencies(
  sessions: Partial<AppRouterDependencies['sessions']> = {},
): AppRouterDependencies {
  return {
    accounts: {},
    catalog: {},
    harnessSignIn: {},
    projects: { database },
    sessions: {
      database,
      roster: new SessionRosterChanges(),
      watchedStatus: { statusOf: () => null },
      supervisor: {
        getSnapshot: () => ({ context: { sessions: {} } }),
        send: () => {},
        on: () => ({ unsubscribe: () => {} }),
      },
      ...sessions,
    },
    tickets: {},
    workspaces: { database },
  } as unknown as AppRouterDependencies
}

async function firstRosterUpdates() {
  const updates: inferRouterOutputs<AppRouter>['sessionList'][] = []
  const stream = await createAppRouter(routerDependencies())
    .createCaller({})
    .sessionList({ projectId: 'project-1', pageSize: 30 })
  stream.subscribe({ next: (update) => updates.push(update) }).unsubscribe()
  return updates
}

beforeEach(async () => {
  userData = await mkdtemp(path.join(os.tmpdir(), 'argo-session-router-'))
  database = openDatabase(userData, { migrationsFolder: databaseMigrationsFolder() })
})

afterEach(async () => {
  database.$client.close()
  await rm(userData, { recursive: true, force: true })
})

test('registers the Session roster subscription on the global router', async () => {
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
  const updates = await firstRosterUpdates()
  expect(updates[0]).toMatchObject({
    type: 'list',
    pages: 1,
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

test('lists the Subagents the sync read from each Session history', async () => {
  database
    .insert(project)
    .values({ id: 'project-1', path: '/work/one', commonDirectory: '/work/one/.git' })
    .run()
  saveSessionBatch(database, 'codex', [
    { nativeId: 'native-2', projectId: 'project-1', cwd: '/work/one', activityAt: 1 },
  ])
  await refreshSessionSubagents({
    database,
    harness: 'codex',
    readHistory: async () => [
      {
        kind: 'delegation',
        id: 'call-1',
        event: 'started',
        agentId: 'agent-1',
        status: 'running',
        name: 'Survey',
        prompt: null,
        model: null,
        summary: null,
      },
    ],
    committed: () => {},
    stopped: () => false,
  })

  const updates = await firstRosterUpdates()

  expect(updates[0]?.type === 'list' && updates[0].rows[0]?.subagents).toEqual([
    { id: 'agent-1', label: 'Survey', state: 'running', startedAt: null, endedAt: null },
  ])
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
  const dependencies = routerDependencies({
    rename: async (request) => {
      renamed.push(request)
    },
  })

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
  const dependencies = routerDependencies({
    rename: async () => {
      throw new Error('Harness rejected the rename.')
    },
  })

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
  const dependencies = routerDependencies({ rename: async () => undefined })
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

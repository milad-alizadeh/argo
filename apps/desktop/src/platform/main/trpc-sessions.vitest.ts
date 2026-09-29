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
    stored: () => {},
    stopped: () => false,
  })

  const updates = await firstRosterUpdates()

  expect(updates[0]?.type === 'list' && updates[0].rows[0]?.subagents).toEqual([
    { id: 'agent-1', label: 'Survey', state: 'running', startedAt: null, endedAt: null },
  ])
})

test('reads historical Feed content through the saved Session Harness adapter', async () => {
  const sessionId = '00000000-0000-4000-8000-000000000003'
  database
    .insert(sessionTable)
    .values({
      argoId: sessionId,
      harness: 'claude',
      nativeId: 'vendor-session',
      cwd: '/work/project',
    })
    .run()
  const reads: unknown[] = []
  const dependencies = routerDependencies({
    readHistory: async (harness, target) => {
      reads.push({ harness, target })
      return [{ kind: 'message', id: 'message-1', role: 'user', text: 'Hello' }]
    },
  })

  const reply = await createAppRouter(dependencies).createCaller({}).sessionFeedRead({ sessionId })
  expect(reply).toMatchObject({
    type: 'session.feed.read',
    sessionId,
    content: [{ kind: 'message', role: 'user', text: 'Hello' }],
  })
  expect(reply).not.toHaveProperty('rows')
  expect(reads).toEqual([
    {
      harness: 'claude',
      target: { nativeId: 'vendor-session', subagentId: null, cwd: '/work/project' },
    },
  ])
})

test('returns the complete vendor history in one snapshot with no page cursor', async () => {
  const sessionId = '00000000-0000-4000-8000-000000000007'
  database
    .insert(sessionTable)
    .values({ argoId: sessionId, harness: 'claude', nativeId: 'long-root' })
    .run()
  const history = Array.from({ length: 400 }, (_, index) => ({
    kind: 'message' as const,
    id: `message-${index}`,
    role: 'assistant' as const,
    text: `Reply ${index} ${'x'.repeat(2048)}`,
  }))
  const dependencies = routerDependencies({ readHistory: async () => history })
  const caller = createAppRouter(dependencies).createCaller({})

  const reply = await caller.sessionFeedRead({ sessionId })
  expect(reply.content.map((item) => item.id)).toEqual(history.map((item) => item.id))
  expect(reply).not.toHaveProperty('olderCursor')
  await expect(
    caller.sessionFeedRead({ sessionId, before: 'cursor' } as { sessionId: string }),
  ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
})

test('reads a selected subagent through its parent Harness and retains the Session chain', async () => {
  const sessionId = '00000000-0000-4000-8000-000000000005'
  database
    .insert(sessionTable)
    .values({
      argoId: sessionId,
      harness: 'codex',
      nativeId: 'root-thread',
      cwd: '/work/project',
    })
    .run()
  const targets: unknown[] = []
  const dependencies = routerDependencies({
    readHistory: async (harness, target) => {
      targets.push({ harness, target })
      return [{ kind: 'message', id: 'child-message', role: 'assistant', text: 'Child result' }]
    },
  })

  await expect(
    createAppRouter(dependencies).createCaller({}).sessionFeedRead({
      sessionId,
      subagentId: 'child-thread',
    }),
  ).resolves.toMatchObject({
    sessionId,
    chainId: 'child-thread',
    content: [{ id: 'child-message', text: 'Child result' }],
  })
  expect(targets).toEqual([
    {
      harness: 'codex',
      target: { nativeId: 'root-thread', subagentId: 'child-thread', cwd: '/work/project' },
    },
  ])
})

test('reports a failed vendor history read instead of confirming an empty Feed', async () => {
  const sessionId = '00000000-0000-4000-8000-000000000006'
  database
    .insert(sessionTable)
    .values({ argoId: sessionId, harness: 'claude', nativeId: 'root' })
    .run()
  const dependencies = routerDependencies({
    readHistory: async () => {
      throw new Error('offline')
    },
  })

  await expect(
    createAppRouter(dependencies).createCaller({}).sessionFeedRead({ sessionId }),
  ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR', message: 'vendor-history-unavailable' })
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

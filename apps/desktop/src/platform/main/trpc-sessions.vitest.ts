import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { inferRouterOutputs } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { type Database, databaseMigrationsFolder, openDatabase } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { sessionArchive } from '@/database/session-archive/schema'
import { SessionActivities } from '@/domains/sessions/main/api/session-activities'
import { SessionRosterChanges } from '@/domains/sessions/main/api/session-roster-changes'
import { recordLiveSubagents } from '@/domains/sessions/main/database/session-subagents'
import { saveSessionBatch } from '@/domains/sessions/main/sync/session-sync-records'
import { sessionRouterDependencies } from '@/mocks/sessions/session-router-dependencies.fixture'
import { type AppRouter, type AppRouterDependencies, createAppRouter } from './trpc-router'

let userData: string
let database: Database

function routerDependencies(
  sessions: Partial<AppRouterDependencies['sessions']> = {},
): AppRouterDependencies {
  return sessionRouterDependencies(database, sessions)
}

function firstPage() {
  return createAppRouter(routerDependencies())
    .createCaller({})
    .sessionList({ projectId: 'project-1' })
}

beforeEach(async () => {
  userData = await mkdtemp(path.join(os.tmpdir(), 'argo-session-router-'))
  database = openDatabase(userData, { migrationsFolder: databaseMigrationsFolder() })
})

afterEach(async () => {
  database.$client.close()
  await rm(userData, { recursive: true, force: true })
})

test('registers the Session List query on the global router', async () => {
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
  expect(await firstPage()).toMatchObject({
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

function insertActivitySessions(ids: readonly string[]) {
  for (const [index, id] of ids.entries())
    database
      .insert(sessionTable)
      .values({
        argoId: id,
        harness: 'claude',
        nativeId: `native-${index}`,
        projectId: 'project-1',
        firstPrompt: `Session ${index}`,
        createdAt: index + 1,
      })
      .run()
}

test('keeps both roster activities when the selected Feed changes', async () => {
  database
    .insert(project)
    .values({ id: 'project-1', path: '/work/one', commonDirectory: '/work/one/.git' })
    .run()
  const ids = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
  ] as const
  insertActivitySessions(ids)
  const roster = new SessionRosterChanges()
  const activities = new SessionActivities({ database, roster })
  const caller = createAppRouter(
    routerDependencies({
      roster,
      activities,
      readHistory: async (_harness, target) => [
        { kind: 'message', id: 'prompt', role: 'user', text: 'Go' },
        {
          kind: 'command',
          id: 'command',
          command: target.nativeId,
          cwd: null,
          status: 'completed',
          output: null,
          stderr: null,
          exitCode: 0,
        },
      ],
    }),
  ).createCaller({})
  const changes: inferRouterOutputs<AppRouter>['sessionListChanged'][] = []
  const changeStream = await caller.sessionListChanged()
  const changeSubscription = changeStream.subscribe({ next: (change) => changes.push(change) })
  const firstStream = await caller.sessionFeed({ sessionId: ids[0] })
  const firstSubscription = firstStream.subscribe({ next: () => {} })
  const secondStream = await caller.sessionFeed({ sessionId: ids[1] })
  const secondSubscription = secondStream.subscribe({ next: () => {} })
  try {
    await new Promise((resolve) => setImmediate(resolve))
    firstSubscription.unsubscribe()
    await new Promise((resolve) => setImmediate(resolve))
    expect(ids.map((id) => activities.activityOf(id)?.label)).toEqual([
      'Ran native-0',
      'Ran native-1',
    ])
    expect(new Set(changes.flatMap(({ sessionIds }) => sessionIds))).toEqual(new Set(ids))
  } finally {
    secondSubscription.unsubscribe()
    changeSubscription.unsubscribe()
  }
})

test('lists the Subagents a watched Session named', async () => {
  database
    .insert(project)
    .values({ id: 'project-1', path: '/work/one', commonDirectory: '/work/one/.git' })
    .run()
  saveSessionBatch(database, 'codex', [
    { nativeId: 'native-2', projectId: 'project-1', cwd: '/work/one', activityAt: 1 },
  ])
  recordLiveSubagents(database, {
    harness: 'codex',
    nativeId: 'native-2',
    events: [
      {
        type: 'content',
        commandId: null,
        turnId: null,
        vendorEventId: null,
        content: {
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
      },
    ],
  })

  expect((await firstPage()).rows[0]?.subagents).toEqual([
    { id: 'agent-1', label: 'Survey', state: 'running', startedAt: null, endedAt: null },
  ])
})

test('renames a saved Session through sessionUpdate after the Harness accepts it', async () => {
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
    createAppRouter(dependencies).createCaller({}).sessionUpdate({
      sessionIds: ['00000000-0000-4000-8000-000000000002'],
      title: 'Confirmed title',
    }),
  ).resolves.toMatchObject([{ customTitle: 'Confirmed title' }])
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
    createAppRouter(dependencies).createCaller({}).sessionUpdate({
      sessionIds: ['00000000-0000-4000-8000-000000000003'],
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

  await caller.sessionUpdate({
    sessionIds: ['00000000-0000-4000-8000-000000000004'],
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

async function firstDetails(dependencies: AppRouterDependencies, sessionId: string) {
  const updates: inferRouterOutputs<AppRouter>['sessionDetails'][] = []
  const stream = await createAppRouter(dependencies).createCaller({}).sessionDetails({ sessionId })
  stream.subscribe({ next: (update) => updates.push(update) }).unsubscribe()
  return updates
}

test('reads a Session beyond the loaded roster window by ID without reading its history', async () => {
  database
    .insert(project)
    .values({ id: 'project-1', path: '/work/one', commonDirectory: '/work/one/.git' })
    .run()
  const ids = Array.from(
    { length: 40 },
    (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  )
  insertActivitySessions(ids)
  const historyReads: string[] = []
  const dependencies = routerDependencies({
    readHistory: async (_harness, target) => {
      historyReads.push(target.nativeId)
      return []
    },
  })
  const listed = await firstPage()

  const updates = await firstDetails(dependencies, ids[0] ?? '')

  expect(listed.rows.map(({ id }) => id)).not.toContain(ids[0])
  expect(updates).toEqual([
    {
      sessionId: ids[0],
      details: expect.objectContaining({
        id: ids[0],
        harness: 'claude',
        projectId: 'project-1',
        archived: false,
        posture: null,
        title: { text: 'Session 0', source: 'first-prompt' },
      }),
    },
  ])
  await new Promise((resolve) => setImmediate(resolve))
  expect(historyReads).toEqual([])
})

test('reads an archived Session by ID and says it is archived', async () => {
  const id = '00000000-0000-4000-8000-000000000009'
  database
    .insert(project)
    .values({ id: 'project-1', path: '/work/one', commonDirectory: '/work/one/.git' })
    .run()
  insertActivitySessions([id])
  database.insert(sessionArchive).values({ sessionId: id }).run()

  const updates = await firstDetails(routerDependencies(), id)

  expect(updates).toEqual([
    { sessionId: id, details: expect.objectContaining({ id, archived: true }) },
  ])
})

test('reads no details for an unknown Session ID', async () => {
  const id = '00000000-0000-4000-8000-00000000000f'

  expect(await firstDetails(routerDependencies(), id)).toEqual([{ sessionId: id, details: null }])
})

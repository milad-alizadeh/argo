import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { inferRouterOutputs } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { type Database, databaseMigrationsFolder, openDatabase } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { insertSession } from '@/mocks/sessions/session-list-caller'
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

function insertActivitySessions(ids: readonly string[]) {
  for (const [index, id] of ids.entries())
    insertSession(database, {
      id,
      nativeId: `native-${index}`,
      firstPrompt: `Session ${index}`,
      createdAt: index + 1,
    })
}

test('keeps both roster activities when the selected Feed changes', async () => {
  const ids = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
  ] as const
  insertActivitySessions(ids)
  const caller = createAppRouter(
    routerDependencies({
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
    const { rows } = await firstPage()
    expect(rows.map((row) => row.activity?.label)).toEqual(['Ran native-1', 'Ran native-0'])
    expect(new Set(changes.flatMap(({ sessionIds }) => sessionIds))).toEqual(new Set(ids))
  } finally {
    secondSubscription.unsubscribe()
    changeSubscription.unsubscribe()
  }
})

test('keeps the existing title when the Harness rejects a rename', async () => {
  insertSession(database, {
    id: '00000000-0000-4000-8000-000000000003',
    customTitle: 'Before',
  })
  const dependencies = routerDependencies({
    rename: async () => {
      throw new Error('Harness rejected the rename.')
    },
  })

  await expect(
    createAppRouter(dependencies)
      .createCaller({})
      .sessionUpdate({
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

function readDetails(dependencies: AppRouterDependencies, sessionId: string) {
  return createAppRouter(dependencies).createCaller({}).sessionDetails({ sessionId })
}

test('reads a Session beyond the loaded roster window by ID without reading its history', async () => {
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

  const details = await readDetails(dependencies, ids[0] ?? '')

  expect(listed.rows.map(({ id }) => id)).not.toContain(ids[0])
  expect(details).toEqual(
    expect.objectContaining({
      id: ids[0],
      harness: 'claude',
      projectId: 'project-1',
      archived: false,
      posture: null,
      title: { text: 'Session 0', source: 'first-prompt' },
    }),
  )
  await new Promise((resolve) => setImmediate(resolve))
  expect(historyReads).toEqual([])
})

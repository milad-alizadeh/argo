import type { inferRouterOutputs } from '@trpc/server'
import { afterEach, beforeEach, expect, test } from 'vitest'
import type { Database } from '@/database/database'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { insertSession } from '@/mocks/sessions/session-list-caller'
import { sessionRouterDependencies } from '@/mocks/sessions/session-router-dependencies.fixture'
import { type AppRouter, type AppRouterDependencies, createAppRouter } from './trpc-router'

let database: Database

function routerDependencies(
  sessions: Parameters<typeof sessionRouterDependencies>[1] = {},
): AppRouterDependencies {
  return sessionRouterDependencies(database, sessions)
}

function firstPage() {
  return createAppRouter(routerDependencies())
    .createCaller({})
    .sessionList({ projectId: 'project-1' })
}

beforeEach(() => {
  database = migratedDatabase()
})

afterEach(() => {
  database.$client.close()
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

test('keeps both Session List activities when the selected Feed changes', async () => {
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
          status: 'completed',
          output: null,
          stderr: null,
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

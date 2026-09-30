import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createActor } from 'xstate'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import type {
  SessionSummaryList,
  SessionSummaryReader,
} from '@/domains/sessions/api/session-discovery'
import { SessionListChanges } from '@/domains/sessions/main/api'
import { sessionSyncSupervisorMachine } from '@/domains/sessions/main/sync'
import type { Harness } from '@/harnesses/harness'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { sessionRouterDependencies } from '@/mocks/sessions/session-router-dependencies.fixture'
import { createAppRouter } from './trpc-router'

let database: Database

beforeEach(() => {
  vi.useFakeTimers()
  database = migratedDatabase()
  database
    .insert(project)
    .values({ id: 'project-1', path: '/work/one', commonDirectory: '/work/one/.git' })
    .run()
})

afterEach(() => {
  vi.useRealTimers()
  database.$client.close()
})

const record = (nativeId: string) => ({ nativeId, cwd: '/work/one', activityAt: 1 })

type Registration = {
  listSessionSummaries?: SessionSummaryList
  getSessionSummary?: SessionSummaryReader
}

function startSync(registrations: Partial<Record<Harness, Registration>>, readHistory = vi.fn()) {
  const harnesses = Object.fromEntries(
    Object.entries(registrations).map(([harness, registration]) => [
      harness,
      {
        listSessionSummaries: async () => ({ records: [], skipped: 0 }),
        getSessionSummary: async () => null,
        // The registry hands sync a history reader too; sync must never call it.
        readHistory,
        ...registration,
      },
    ]),
  )
  const changes = new SessionListChanges()
  const actor = createActor(sessionSyncSupervisorMachine, {
    input: {
      database,
      changes,
      harnesses,
    },
  }).start()
  const router = createAppRouter(sessionRouterDependencies(database, { changes }))
  return { actor, readHistory, router }
}

function readList(router: ReturnType<typeof startSync>['router']) {
  return router.createCaller({}).sessionList({ projectId: 'project-1' })
}

test.each(['claude', 'codex'] as const)(
  'lists a new %s Session the watcher saw, without a Refresh',
  async (harness) => {
    const requested: string[] = []
    const listSessionSummaries = vi.fn<SessionSummaryList>()
    const { actor, router } = startSync({
      [harness]: {
        listSessionSummaries,
        getSessionSummary: async (nativeId: string) => {
          requested.push(nativeId)
          return record(nativeId)
        },
      },
    })
    try {
      actor.send({ type: 'Discover', harness, nativeId: 'new-session' })
      await vi.advanceTimersByTimeAsync(0)
      expect(await readList(router)).toMatchObject({ total: 1 })
      expect(requested).toEqual(['new-session'])
      expect(listSessionSummaries).not.toHaveBeenCalled()
    } finally {
      actor.stop()
    }
  },
)

test('coalesces repeated requests for the same Session', async () => {
  let calls = 0
  const { actor } = startSync({
    claude: {
      getSessionSummary: async (nativeId) => {
        calls += 1
        return record(nativeId)
      },
    },
  })
  try {
    for (let index = 0; index < 5; index += 1)
      actor.send({ type: 'Discover', harness: 'claude', nativeId: 'new-session' })
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toBe(1)
  } finally {
    actor.stop()
  }
})

test('retries with a growing delay until the Harness lists the Session', async () => {
  const attemptTimes: number[] = []
  const start = Date.now()
  const { actor, router } = startSync({
    codex: {
      getSessionSummary: async (nativeId) => {
        attemptTimes.push(Date.now() - start)
        return attemptTimes.length < 3 ? null : record(nativeId)
      },
    },
  })
  try {
    actor.send({ type: 'Discover', harness: 'codex', nativeId: 'late-session' })
    await vi.advanceTimersByTimeAsync(60_000)
    const gaps = attemptTimes.slice(1).map((time, index) => time - (attemptTimes[index] ?? 0))
    expect(attemptTimes).toHaveLength(3)
    expect(gaps[1]).toBeGreaterThan(gaps[0] ?? Number.POSITIVE_INFINITY)
    expect(await readList(router)).toMatchObject({ total: 1 })
  } finally {
    actor.stop()
  }
})

test('stops after the last retry, and a later write asks again', async () => {
  let calls = 0
  const { actor } = startSync({
    claude: {
      getSessionSummary: async () => {
        calls += 1
        return null
      },
    },
  })
  try {
    actor.send({ type: 'Discover', harness: 'claude', nativeId: 'ghost' })
    await vi.advanceTimersByTimeAsync(60_000)
    const attempts = calls
    expect(attempts).toBeGreaterThan(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls).toBe(attempts)
    actor.send({ type: 'Discover', harness: 'claude', nativeId: 'ghost' })
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toBe(attempts + 1)
  } finally {
    actor.stop()
  }
})

test('a full sync reads no history and stores no Subagents', async () => {
  const { actor, readHistory, router } = startSync({
    claude: { listSessionSummaries: async () => ({ records: [record('listed')], skipped: 0 }) },
  })
  try {
    actor.send({ type: 'Refresh' })
    await vi.advanceTimersByTimeAsync(1_000)
    const list = await readList(router)
    expect(list).toMatchObject({ total: 1 })
    expect(readHistory).not.toHaveBeenCalled()
    expect(list.rows[0]?.subagents).toEqual([])
  } finally {
    actor.stop()
  }
})

import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createActor } from 'xstate'
import { type Database, databaseMigrationsFolder, openDatabase } from '@/database/database'
import { project } from '@/database/project/schema'
import type { SessionDiscovery } from '@/domains/sessions/api/session-discovery'
import { SessionSyncStatusStore } from '@/domains/sessions/main/api/session-sync-status'
import { sessionSyncSupervisorMachine } from '@/domains/sessions/main/sync/session-sync-supervisor-machine'
import type { Harness } from '@/harnesses/harness'
import { sessionRouterDependencies } from '@/mocks/sessions/session-router-dependencies.fixture'
import { createAppRouter } from './trpc-router'

let userData: string
let database: Database

beforeEach(async () => {
  vi.useFakeTimers()
  userData = await mkdtemp(path.join(os.tmpdir(), 'argo-session-discovery-'))
  database = openDatabase(userData, { migrationsFolder: databaseMigrationsFolder() })
  database
    .insert(project)
    .values({ id: 'project-1', path: '/work/one', commonDirectory: '/work/one/.git' })
    .run()
})

afterEach(async () => {
  vi.useRealTimers()
  database.$client.close()
  await rm(userData, { recursive: true, force: true })
})

const record = (nativeId: string) => ({ nativeId, cwd: '/work/one', activityAt: 1 })

function startSync(discovery: Partial<Record<Harness, SessionDiscovery>>, readHistory = vi.fn()) {
  const harnesses = Object.fromEntries(
    Object.entries(discovery).map(([harness, sessionDiscovery]) => [
      harness,
      // The registry hands sync a history reader too; sync must never call it.
      { sessionDiscovery, readHistory },
    ]),
  )
  const actor = createActor(sessionSyncSupervisorMachine, {
    input: {
      database,
      harnesses,
      status: {
        claude: new SessionSyncStatusStore(database, 'claude'),
        codex: new SessionSyncStatusStore(database, 'codex'),
      },
    },
  }).start()
  const router = createAppRouter(sessionRouterDependencies(database))
  return { actor, readHistory, router }
}

async function listedNativeIds(router: ReturnType<typeof startSync>['router']) {
  const updates: Array<{ type: string; rows?: Array<{ subagents?: unknown }> }> = []
  const stream = await router.createCaller({}).sessionList({ projectId: 'project-1', pageSize: 30 })
  stream.subscribe({ next: (update) => updates.push(update) }).unsubscribe()
  return updates
}

test.each(['claude', 'codex'] as const)(
  'lists a new %s Session the watcher saw, without a Refresh',
  async (harness) => {
    const requests: Array<{ nativeId?: string }> = []
    const sessionDiscovery: SessionDiscovery = async (input) => {
      requests.push(input)
      return {
        records: input.nativeId === 'new-session' ? [record('new-session')] : [],
        skipped: 0,
      }
    }
    const { actor, router } = startSync({ [harness]: sessionDiscovery })
    try {
      actor.send({ type: 'Discover', harness, nativeId: 'new-session' })
      await vi.advanceTimersByTimeAsync(0)
      const updates = await listedNativeIds(router)
      expect(updates[0]).toMatchObject({ type: 'list', total: 1 })
      expect(requests).toEqual([expect.objectContaining({ nativeId: 'new-session' })])
    } finally {
      actor.stop()
    }
  },
)

test('coalesces repeated requests for the same Session', async () => {
  let calls = 0
  const { actor } = startSync({
    claude: async () => {
      calls += 1
      return { records: [record('new-session')], skipped: 0 }
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
    codex: async () => {
      attemptTimes.push(Date.now() - start)
      return { records: attemptTimes.length < 3 ? [] : [record('late-session')], skipped: 0 }
    },
  })
  try {
    actor.send({ type: 'Discover', harness: 'codex', nativeId: 'late-session' })
    await vi.advanceTimersByTimeAsync(60_000)
    const gaps = attemptTimes.slice(1).map((time, index) => time - (attemptTimes[index] ?? 0))
    expect(attemptTimes).toHaveLength(3)
    expect(gaps[1]).toBeGreaterThan(gaps[0] ?? Number.POSITIVE_INFINITY)
    expect((await listedNativeIds(router))[0]).toMatchObject({ total: 1 })
  } finally {
    actor.stop()
  }
})

test('gives up on a Session the Harness never lists, then asks again after a cooldown', async () => {
  let calls = 0
  const { actor } = startSync({
    claude: async () => {
      calls += 1
      return { records: [], skipped: 0 }
    },
  })
  try {
    actor.send({ type: 'Discover', harness: 'claude', nativeId: 'ghost' })
    await vi.advanceTimersByTimeAsync(25_000)
    const attempts = calls
    expect(attempts).toBeGreaterThan(1)
    actor.send({ type: 'Discover', harness: 'claude', nativeId: 'ghost' })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(calls).toBe(attempts)
    await vi.advanceTimersByTimeAsync(60_000)
    actor.send({ type: 'Discover', harness: 'claude', nativeId: 'ghost' })
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toBe(attempts + 1)
  } finally {
    actor.stop()
  }
})

test('a full sync reads no history and stores no Subagents', async () => {
  const { actor, readHistory, router } = startSync({
    claude: async () => ({ records: [record('listed')], skipped: 0 }),
  })
  try {
    actor.send({ type: 'Refresh' })
    await vi.advanceTimersByTimeAsync(1_000)
    const updates = await listedNativeIds(router)
    expect(updates[0]).toMatchObject({ type: 'list', total: 1 })
    expect(readHistory).not.toHaveBeenCalled()
    expect(updates[0]?.rows?.[0]?.subagents).toEqual([])
  } finally {
    actor.stop()
  }
})

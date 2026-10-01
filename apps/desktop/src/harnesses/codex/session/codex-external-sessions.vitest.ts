import { utimesSync, writeFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { sessionTable } from '@/database/session/schema'
import { ExternalSessionRoster, RUNNING_QUIET_LIMIT_MS } from '@/domains/sessions/main/api'
import {
  mockCodexExternalThreads,
  notLoadedError,
  recordedTurnsPage,
} from '@/mocks/cli/codex/mock-codex-external-threads'
import { insertSession, sessionListCaller } from '@/mocks/sessions/session-list-caller'
import { createCodexExternalSessions } from './codex-external-sessions'

const RUNNING = '01a0f52a-3d1e-7c72-baf4-294547d9af51'
const OTHER = '01a0f52a-3d1e-7c72-baf4-294547d9af52'
const STORED_LINE = { label: 'Stored line', kind: 'command', open: true }

let caller: ReturnType<typeof sessionListCaller>
let discovered: string[]
let live: Set<string>
let threads: ReturnType<typeof mockCodexExternalThreads>
let roster: ExternalSessionRoster

function startRoster() {
  roster = new ExternalSessionRoster({
    database: caller.database,
    changes: caller.sessionListChanges,
    harnesses: [
      {
        harness: 'codex',
        external: createCodexExternalSessions(threads.request, threads.codexHome),
      },
    ],
    hasLiveChannel: (sessionId) => live.has(sessionId),
    discover: ({ nativeId }) => discovered.push(nativeId),
  })
}

beforeEach(() => {
  caller = sessionListCaller()
  discovered = []
  live = new Set()
  threads = mockCodexExternalThreads()
  startRoster()
})

afterEach(() => {
  roster.stop()
  vi.useRealTimers()
  vi.restoreAllMocks()
  threads.dispose()
  caller.stopWatching()
  caller.database.$client.close()
})

function saved(id: string, values: Partial<typeof sessionTable.$inferInsert> = {}) {
  insertSession(caller.database, { id, harness: 'codex', ...values })
}

// What the Session List shows for one row.
async function row(id: string) {
  const found = (await caller.list({ projectId: 'project-1' })).rows.find((each) => each.id === id)
  return {
    status: found?.status,
    activity: found?.activity ?? null,
    updatedAt: found?.updatedAt,
  }
}

const settleReads = () => new Promise((resolve) => setTimeout(resolve, 50))

// Waits for the reads a tick started, then writes what they queued.
async function tickAndWrite() {
  await roster.tick()
  await settleReads()
  roster.flush()
}

// Polls on the real event loop, which fake timeouts leave alone.
async function until(condition: () => boolean) {
  for (let turn = 0; turn < 10_000 && !condition(); turn += 1)
    await new Promise((resolve) => setImmediate(resolve))
  for (let turn = 0; turn < 10; turn += 1) await new Promise((resolve) => setImmediate(resolve))
}

function quietWarnings() {
  return vi.spyOn(console, 'warn').mockImplementation(() => {})
}

test('startup reads no history: the first tick keeps the stored status and line', async () => {
  saved(RUNNING, { status: 'idle', activity: JSON.stringify(STORED_LINE) })
  const before = await row(RUNNING)
  await threads.open(RUNNING)
  await tickAndWrite()
  expect(threads.turnsReads).toEqual([])
  expect(await row(RUNNING)).toEqual({ ...before, status: 'idle', activity: STORED_LINE })
})

test('a running Session with no Feed open stores its status and newest command', async () => {
  saved(RUNNING)
  const before = await row(RUNNING)
  await threads.open(RUNNING)
  await tickAndWrite()
  threads.answer(RUNNING, 'running')
  threads.append(RUNNING, 'any bytes\n')
  await tickAndWrite()
  expect(threads.turnsReads).toEqual([RUNNING])
  expect((await row(RUNNING)).status).toBe('running')
  expect((await row(RUNNING)).activity).toMatchObject({
    kind: 'command',
    label: expect.stringContaining('sleep 15'),
  })
  expect((await row(RUNNING)).updatedAt).not.toBe(before.updatedAt)
})

test('a Subagent the newest Turn started counts on the row', async () => {
  saved(RUNNING)
  await threads.open(RUNNING)
  await tickAndWrite()
  const page = recordedTurnsPage('running') as { data: { items: unknown[] }[] }
  for (const turn of page.data)
    turn.items.push({
      type: 'subAgentActivity',
      id: 'spawn-1',
      kind: 'started',
      agentThreadId: 'agent-thread-1',
      agentPath: 'explorer',
    })
  threads.answer(RUNNING, { page })
  threads.append(RUNNING, 'any bytes\n')
  await tickAndWrite()
  const found = (await caller.list({ projectId: 'project-1' })).rows.find(
    (each) => each.id === RUNNING,
  )
  expect(found?.subagents).toEqual([
    { id: 'agent-thread-1', label: expect.anything(), state: 'running' },
  ])
})

test('an unchanged rollout asks for nothing', async () => {
  saved(RUNNING)
  await threads.open(RUNNING)
  await tickAndWrite()
  await tickAndWrite()
  expect(threads.turnsReads).toEqual([])
})

test('a rewritten, truncated or touched rollout counts as a change', async () => {
  saved(RUNNING)
  await threads.open(RUNNING, 'one\ntwo\n')
  await tickAndWrite()
  writeFileSync(threads.rollout(RUNNING), 'one\n')
  await tickAndWrite()
  utimesSync(threads.rollout(RUNNING), new Date(1_000_000), new Date(1_000_000))
  await tickAndWrite()
  expect(threads.turnsReads).toEqual([RUNNING, RUNNING])
})

test('a large append is one read', async () => {
  saved(RUNNING)
  await threads.open(RUNNING)
  await tickAndWrite()
  threads.answer(RUNNING, 'running')
  threads.append(RUNNING, `${'x'.repeat(4 * 1024 * 1024)}\n`)
  await tickAndWrite()
  expect(threads.turnsReads).toEqual([RUNNING])
  expect((await row(RUNNING)).status).toBe('running')
})

test('a finished Turn shows idle and the row keeps its line', async () => {
  saved(RUNNING)
  await threads.open(RUNNING)
  await tickAndWrite()
  threads.answer(RUNNING, 'running')
  threads.append(RUNNING, 'x\n')
  await tickAndWrite()
  const line = (await row(RUNNING)).activity
  threads.answer(RUNNING, 'completed')
  threads.append(RUNNING, 'x\n')
  await tickAndWrite()
  expect(await row(RUNNING)).toMatchObject({ status: 'idle', activity: line })
  threads.answer(RUNNING, 'interrupted')
  threads.append(RUNNING, 'x\n')
  await tickAndWrite()
  expect(await row(RUNNING)).toMatchObject({ status: 'idle', activity: line })
})

test('a Turn with no step yet keeps the stored line', async () => {
  saved(RUNNING, { activity: JSON.stringify(STORED_LINE) })
  await threads.open(RUNNING)
  await tickAndWrite()
  threads.answer(RUNNING, 'crashed')
  threads.append(RUNNING, 'x\n')
  await tickAndWrite()
  expect(await row(RUNNING)).toMatchObject({ status: 'running', activity: STORED_LINE })
})

test('a thread no process has loaded, with its lock held, shows idle', async () => {
  saved(RUNNING, { status: 'running' })
  await threads.open(RUNNING)
  await tickAndWrite()
  threads.answer(RUNNING, notLoadedError(RUNNING))
  threads.append(RUNNING, 'x\n')
  await tickAndWrite()
  expect((await row(RUNNING)).status).toBe('idle')
})

test('a read that fails just after a submit shows running and reads again on the next tick', async () => {
  saved(RUNNING, { status: 'idle' })
  await threads.open(RUNNING)
  await tickAndWrite()
  threads.answer(RUNNING, new Error('rollout is still being written'))
  threads.append(RUNNING, 'x\n')
  await tickAndWrite()
  expect((await row(RUNNING)).status).toBe('running')
  threads.answer(RUNNING, 'completed')
  await tickAndWrite()
  expect(threads.turnsReads).toEqual([RUNNING, RUNNING])
  expect((await row(RUNNING)).status).toBe('idle')
})

test('a read that fails later keeps the stored status and line', async () => {
  const warn = quietWarnings()
  vi.useFakeTimers({ toFake: ['Date'] })
  saved(RUNNING, { status: 'idle', activity: JSON.stringify(STORED_LINE) })
  await threads.open(RUNNING)
  await tickAndWrite()
  threads.respondWith(async () => {
    vi.setSystemTime(Date.now() + 3_000)
    throw new Error('vendor read failed')
  })
  threads.append(RUNNING, 'x\n')
  await tickAndWrite()
  expect(await row(RUNNING)).toMatchObject({ status: 'idle', activity: STORED_LINE })
  expect(warn).toHaveBeenCalled()
})

test('a turns page of an unrecognised shape is rejected, reported and keeps the line', async () => {
  const warn = quietWarnings()
  saved(RUNNING, { activity: JSON.stringify(STORED_LINE) })
  await threads.open(RUNNING)
  await tickAndWrite()
  threads.answer(RUNNING, { page: { data: [{ id: 'turn', items: 'not a list' }] } })
  threads.append(RUNNING, 'x\n')
  await tickAndWrite()
  expect((await row(RUNNING)).activity).toEqual(STORED_LINE)
  expect(warn).toHaveBeenCalledWith('Rejected 1 unrecognised Codex turns page.')
})

test('a Session whose writer exits after its Turn finished shows idle', async () => {
  saved(RUNNING)
  await threads.open(RUNNING)
  await tickAndWrite()
  threads.answer(RUNNING, 'completed')
  await threads.close(RUNNING)
  await tickAndWrite()
  expect((await row(RUNNING)).status).toBe('idle')
})

test('a Session whose writer crashed mid-Turn shows unknown', async () => {
  saved(RUNNING)
  await threads.open(RUNNING)
  await tickAndWrite()
  threads.answer(RUNNING, 'crashed')
  await threads.close(RUNNING, { crash: true })
  await tickAndWrite()
  expect((await row(RUNNING)).status).toBe('unknown')
})

test('the first tick closes every saved Session it does not find live', async () => {
  saved(RUNNING, { status: 'unknown' })
  saved(OTHER, { status: 'running' })
  await threads.open(RUNNING)
  await tickAndWrite()
  expect((await row(RUNNING)).status).toBe('unknown')
  expect((await row(OTHER)).status).toBe('idle')
})

test('a new Session with no row is discovered once, and its status lands once the row exists', async () => {
  await threads.open(RUNNING)
  await tickAndWrite()
  await tickAndWrite()
  expect(discovered).toEqual([RUNNING])
  saved(OTHER, { nativeId: RUNNING })
  threads.answer(RUNNING, 'running')
  threads.append(RUNNING, 'x\n')
  await tickAndWrite()
  expect((await row(OTHER)).status).toBe('running')
})

test('a Session with a live Argo channel is skipped, so the channel owns its status and line', async () => {
  saved(RUNNING, { status: 'idle' })
  live.add(RUNNING)
  await threads.open(RUNNING)
  await tickAndWrite()
  threads.answer(RUNNING, 'running')
  threads.append(RUNNING, 'x\n')
  await tickAndWrite()
  await threads.close(RUNNING)
  await tickAndWrite()
  expect(threads.turnsReads).toEqual([])
  expect(await row(RUNNING)).toMatchObject({ status: 'idle', activity: null })
})

test('a running Session whose rollout has not changed for five minutes shows unknown', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  saved(RUNNING)
  await threads.open(RUNNING)
  await tickAndWrite()
  threads.answer(RUNNING, 'running')
  threads.append(RUNNING, 'x\n')
  await tickAndWrite()
  vi.setSystemTime(Date.now() + RUNNING_QUIET_LIMIT_MS - 1_000)
  await tickAndWrite()
  expect((await row(RUNNING)).status).toBe('running')
  vi.setSystemTime(Date.now() + 1_000)
  await tickAndWrite()
  expect((await row(RUNNING)).status).toBe('unknown')
  threads.append(RUNNING, 'x\n')
  await tickAndWrite()
  expect((await row(RUNNING)).status).toBe('running')
})

test('reads run one at a time across Sessions, and a Session that changes mid-read is read once more', async () => {
  saved(RUNNING)
  saved(OTHER)
  await threads.open(RUNNING)
  await threads.open(OTHER)
  await tickAndWrite()
  const settle: ((page: unknown) => void)[] = []
  threads.respondWith(() => new Promise((resolve) => settle.push(resolve)))
  threads.append(RUNNING, 'x\n')
  threads.append(OTHER, 'x\n')
  await roster.tick()
  threads.append(RUNNING, 'x\n')
  await roster.tick()
  threads.append(RUNNING, 'x\n')
  await roster.tick()
  // Each read waits on a lock probe process, so wait for the read itself rather than a fixed time.
  await until(() => settle.length === 1)
  expect(threads.turnsReads).toEqual([RUNNING])
  for (const expected of [
    [RUNNING, OTHER],
    [RUNNING, OTHER, RUNNING],
  ]) {
    settle.shift()?.(recordedTurnsPage('running'))
    await until(() => settle.length === 1)
    expect(threads.turnsReads).toEqual(expected)
  }
  settle.shift()?.(recordedTurnsPage('running'))
  await settleReads()
  expect(threads.turnsReads).toEqual([RUNNING, OTHER, RUNNING])
  expect(settle).toEqual([])
})

test('one Session’s updates within the write window reach SQLite as one write', async () => {
  const announced: string[][] = []
  caller.sessionListChanges.subscribe((sessionIds) => announced.push([...sessionIds]))
  saved(RUNNING)
  await threads.open(RUNNING)
  await roster.tick()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  threads.answer(RUNNING, 'running')
  threads.append(RUNNING, 'x\n')
  await roster.tick()
  await until(() => threads.turnsReads.length === 1)
  await vi.advanceTimersByTimeAsync(0)
  expect((await row(RUNNING)).status).toBe('unknown')
  await vi.advanceTimersByTimeAsync(500)
  expect((await row(RUNNING)).status).toBe('running')
  expect((await row(RUNNING)).activity).not.toBeNull()
  expect(announced).toEqual([[RUNNING]])
})

test('lock files that name no thread are counted and reported', async () => {
  const warn = quietWarnings()
  threads.stray('notes.txt')
  threads.stray('not-a-thread.lock')
  await tickAndWrite()
  expect(warn).toHaveBeenCalledWith('Rejected 2 unrecognised codex live Session record(s).')
})

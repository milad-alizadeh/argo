import { appendFileSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import type { ExternalActivityReading } from '@/harnesses/registration'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { mockActivity, mockExternalSessions } from '@/mocks/sessions/mock-external-sessions'
import { insertSession } from '@/mocks/sessions/session-list-caller'
import { ExternalSessionRoster, RUNNING_QUIET_LIMIT_MS } from './external-session-roster'
import { SessionListChanges } from './session-list-changes'

const RUNNING = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'

let database: Database
let folder: string
let discovered: string[]
let live: Set<string>
let mock: ReturnType<typeof mockExternalSessions>
let roster: ExternalSessionRoster

beforeEach(() => {
  database = migratedDatabase()
  folder = mkdtempSync(path.join(os.tmpdir(), 'argo-external-roster-'))
  discovered = []
  live = new Set()
  mock = mockExternalSessions()
  roster = new ExternalSessionRoster({
    database,
    changes: new SessionListChanges(),
    harnesses: [{ harness: 'claude', external: mock.external }],
    hasLiveChannel: (sessionId) => live.has(sessionId),
    discover: ({ nativeId }) => discovered.push(nativeId),
  })
})

afterEach(() => {
  roster.stop()
  vi.useRealTimers()
  database.$client.close()
  rmSync(folder, { recursive: true, force: true })
})

function transcript(name: string, content: string) {
  const file = path.join(folder, `${name}.jsonl`)
  writeFileSync(file, content)
  return file
}

function row(id: string) {
  const found = database.select().from(sessionTable).where(eq(sessionTable.argoId, id)).get()
  return {
    status: found?.status,
    activity: found?.activity == null ? null : JSON.parse(found.activity),
    activityAt: found?.activityAt ?? null,
  }
}

const settleReads = () => new Promise((resolve) => setImmediate(resolve))

// Waits for the reads a tick started, then writes what they queued.
async function tickAndWrite() {
  await roster.tick()
  await settleReads()
  roster.flush()
}

test('the first tick reads nothing: it stores the listed status and keeps the stored line', async () => {
  insertSession(database, { id: RUNNING, activity: JSON.stringify(mockActivity('Stored line')) })
  mock.open(RUNNING, 'running', transcript('running', 'old history\n'))
  await tickAndWrite()
  expect(mock.reads).toEqual([])
  expect(row(RUNNING)).toEqual({
    status: 'running',
    activity: mockActivity('Stored line'),
    activityAt: null,
  })
})

test('a transcript that grew asks the Harness for the activity, and the row stores it', async () => {
  insertSession(database, { id: RUNNING })
  const file = transcript('running', 'old history\n')
  mock.open(RUNNING, 'running', file)
  await tickAndWrite()
  mock.answer(RUNNING, { activity: mockActivity('bun test') })
  appendFileSync(file, 'any bytes\n')
  await tickAndWrite()
  expect(mock.reads).toEqual([RUNNING])
  expect(row(RUNNING)).toMatchObject({ status: 'running', activity: mockActivity('bun test') })
  expect(row(RUNNING).activityAt).not.toBeNull()
})

test('a transcript that did not change asks for nothing', async () => {
  insertSession(database, { id: RUNNING })
  mock.open(RUNNING, 'running', transcript('running', 'old history\n'))
  await tickAndWrite()
  await tickAndWrite()
  expect(mock.reads).toEqual([])
})

test('a rewritten, truncated or touched transcript counts as a change', async () => {
  insertSession(database, { id: RUNNING })
  const file = transcript('running', 'one\ntwo\n')
  mock.open(RUNNING, 'running', file)
  await tickAndWrite()
  writeFileSync(file, 'one\n')
  await tickAndWrite()
  utimesSync(file, new Date(1_000_000), new Date(1_000_000))
  await tickAndWrite()
  expect(mock.reads).toEqual([RUNNING, RUNNING])
})

test('a Session with no transcript gets its listed status and no read', async () => {
  insertSession(database, { id: RUNNING })
  mock.open(RUNNING, 'running', null)
  await tickAndWrite()
  mock.open(RUNNING, 'permission', null)
  await tickAndWrite()
  expect(mock.reads).toEqual([])
  expect(row(RUNNING).status).toBe('permission')
})

test('a Harness with no activity read gets status and change time only', async () => {
  const statusOnly = mockExternalSessions({ readsActivity: false })
  roster.stop()
  roster = new ExternalSessionRoster({
    database,
    changes: new SessionListChanges(),
    harnesses: [{ harness: 'claude', external: statusOnly.external }],
    hasLiveChannel: () => false,
    discover: () => {},
  })
  insertSession(database, { id: RUNNING, activity: JSON.stringify(mockActivity('Stored line')) })
  const file = transcript('running', '')
  statusOnly.open(RUNNING, 'running', file)
  await tickAndWrite()
  appendFileSync(file, 'x\n')
  await tickAndWrite()
  expect(statusOnly.reads).toEqual([])
  expect(row(RUNNING)).toMatchObject({ status: 'running', activity: mockActivity('Stored line') })
  expect(row(RUNNING).activityAt).not.toBeNull()
})

test('an idle row keeps its line when a read names no activity', async () => {
  insertSession(database, { id: RUNNING })
  const file = transcript('running', '')
  mock.open(RUNNING, 'running', file)
  await tickAndWrite()
  mock.answer(RUNNING, { activity: mockActivity('bun run typecheck') })
  appendFileSync(file, 'x\n')
  await tickAndWrite()
  mock.answer(RUNNING, { status: 'idle' })
  appendFileSync(file, 'x\n')
  await tickAndWrite()
  expect(row(RUNNING)).toMatchObject({
    status: 'idle',
    activity: mockActivity('bun run typecheck'),
  })
})

test('a read that fails keeps the stored line', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  insertSession(database, { id: RUNNING, activity: JSON.stringify(mockActivity('Stored line')) })
  const file = transcript('running', '')
  mock.open(RUNNING, 'running', file)
  await tickAndWrite()
  mock.respondWith(() => Promise.reject(new Error('vendor read failed')))
  appendFileSync(file, 'x\n')
  await tickAndWrite()
  expect(row(RUNNING)).toMatchObject({ status: 'running', activity: mockActivity('Stored line') })
  expect(warn).toHaveBeenCalled()
  warn.mockRestore()
})

test('a Session that leaves the live list, such as for a dead pid, shows idle', async () => {
  insertSession(database, { id: RUNNING })
  mock.open(RUNNING, 'running', null)
  await tickAndWrite()
  mock.close(RUNNING)
  await tickAndWrite()
  expect(row(RUNNING).status).toBe('idle')
})

test('the first tick closes every saved Session it does not find live', async () => {
  insertSession(database, { id: RUNNING, status: 'unknown' })
  insertSession(database, { id: OTHER, status: 'running' })
  mock.open(RUNNING, 'permission', null)
  await tickAndWrite()
  expect(row(RUNNING).status).toBe('permission')
  expect(row(OTHER).status).toBe('idle')
})

test('a live Session with no row is discovered once, and its status lands once the row exists', async () => {
  mock.open('native-new', 'running', null)
  await tickAndWrite()
  await tickAndWrite()
  expect(discovered).toEqual(['native-new'])
  insertSession(database, { id: OTHER, nativeId: 'native-new' })
  await tickAndWrite()
  expect(row(OTHER).status).toBe('running')
})

test('a Session with a live Argo channel is skipped, so the channel owns its status and line', async () => {
  insertSession(database, { id: RUNNING, status: 'idle' })
  live.add(RUNNING)
  const file = transcript('running', '')
  mock.open(RUNNING, 'running', file)
  await tickAndWrite()
  appendFileSync(file, 'x\n')
  await tickAndWrite()
  expect(mock.reads).toEqual([])
  expect(row(RUNNING)).toMatchObject({ status: 'idle', activity: null })
})

test('a status a read settles outranks the listed one', async () => {
  insertSession(database, { id: RUNNING })
  const file = transcript('running', '')
  mock.open(RUNNING, 'unknown', file)
  await tickAndWrite()
  mock.answer(RUNNING, { status: 'running' })
  appendFileSync(file, 'x\n')
  await tickAndWrite()
  expect(row(RUNNING).status).toBe('running')
  mock.answer(RUNNING, { status: 'idle' })
  appendFileSync(file, 'x\n')
  await tickAndWrite()
  expect(row(RUNNING).status).toBe('idle')
})

test('a running Session whose transcript has not grown for five minutes shows unknown', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  insertSession(database, { id: RUNNING })
  const file = transcript('running', '')
  mock.open(RUNNING, 'running', file)
  await tickAndWrite()
  vi.setSystemTime(Date.now() + RUNNING_QUIET_LIMIT_MS - 1_000)
  await tickAndWrite()
  expect(row(RUNNING).status).toBe('running')
  vi.setSystemTime(Date.now() + 1_000)
  await tickAndWrite()
  expect(row(RUNNING).status).toBe('unknown')
  appendFileSync(file, 'x\n')
  await tickAndWrite()
  expect(row(RUNNING).status).toBe('running')
})

test('reads run one at a time across Sessions, and a Session that grows mid-read is read once more', async () => {
  insertSession(database, { id: RUNNING })
  insertSession(database, { id: OTHER })
  const running = transcript('running', '')
  const other = transcript('other', '')
  mock.open(RUNNING, 'running', running)
  mock.open(OTHER, 'running', other)
  await tickAndWrite()
  const settle: ((reading: ExternalActivityReading) => void)[] = []
  mock.respondWith(() => new Promise((resolve) => settle.push(resolve)))
  appendFileSync(running, 'x\n')
  appendFileSync(other, 'x\n')
  await roster.tick()
  appendFileSync(running, 'x\n')
  await roster.tick()
  appendFileSync(running, 'x\n')
  await roster.tick()
  expect(mock.reads).toEqual([RUNNING])
  const nothing = { activity: null, status: null }
  settle.shift()?.(nothing)
  await settleReads()
  expect(mock.reads).toEqual([RUNNING, OTHER])
  settle.shift()?.(nothing)
  await settleReads()
  expect(mock.reads).toEqual([RUNNING, OTHER, RUNNING])
  settle.shift()?.(nothing)
  await settleReads()
  expect(mock.reads).toEqual([RUNNING, OTHER, RUNNING])
})

test('one Session’s updates within the write window reach SQLite as one write', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const changes = new SessionListChanges()
  const announced: string[][] = []
  changes.subscribe((sessionIds) => announced.push([...sessionIds]))
  roster.stop()
  roster = new ExternalSessionRoster({
    database,
    changes,
    harnesses: [{ harness: 'claude', external: mock.external }],
    hasLiveChannel: () => false,
    discover: () => {},
  })
  insertSession(database, { id: RUNNING })
  const file = transcript('running', '')
  mock.open(RUNNING, 'running', file)
  await roster.tick()
  mock.answer(RUNNING, { activity: mockActivity('first') })
  appendFileSync(file, 'x\n')
  await roster.tick()
  await vi.advanceTimersByTimeAsync(0)
  expect(row(RUNNING).status).toBe('unknown')
  await vi.advanceTimersByTimeAsync(500)
  expect(row(RUNNING)).toMatchObject({ status: 'running', activity: mockActivity('first') })
  expect(announced).toEqual([[RUNNING]])
})

test('unrecognised records are counted and reported', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  mock.reject(2)
  await tickAndWrite()
  expect(warn).toHaveBeenCalledWith('Rejected 2 unrecognised claude live Session record(s).')
  warn.mockRestore()
})

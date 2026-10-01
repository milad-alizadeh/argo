import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import type { TranscriptReading } from '@/harnesses/registration'
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

// Waits for the reads a tick started, then writes what they queued.
async function tickAndWrite() {
  await roster.tick()
  await new Promise((resolve) => setImmediate(resolve))
  roster.flush()
}

test('the first tick reads no history: it stores the listed status and starts at the end', async () => {
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

test('a running Session with no Feed open takes its line from the bytes it appended', async () => {
  insertSession(database, { id: RUNNING })
  const file = transcript('running', 'old history\n')
  mock.open(RUNNING, 'running', file)
  await tickAndWrite()
  appendFileSync(file, 'bun test\n')
  await tickAndWrite()
  expect(mock.reads.map(({ lines }) => lines)).toEqual([{ lines: ['bun test'], continued: true }])
  expect(row(RUNNING)).toMatchObject({ status: 'running', activity: mockActivity('bun test') })
  expect(row(RUNNING).activityAt).not.toBeNull()
})

test('an idle row keeps its line when the newest lines name no activity', async () => {
  insertSession(database, { id: RUNNING })
  const file = transcript('running', '')
  mock.open(RUNNING, 'running', file)
  await tickAndWrite()
  appendFileSync(file, 'bun run typecheck\n')
  await tickAndWrite()
  mock.open(RUNNING, 'idle', file)
  appendFileSync(file, 'status:idle\n')
  await tickAndWrite()
  expect(row(RUNNING)).toMatchObject({
    status: 'idle',
    activity: mockActivity('bun run typecheck'),
  })
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

test('a rewritten transcript hands over its window as lines that do not continue', async () => {
  insertSession(database, { id: RUNNING })
  const file = transcript('running', 'one\ntwo\n')
  mock.open(RUNNING, 'running', file)
  await tickAndWrite()
  writeFileSync(file, 'compacted\nnext step\n')
  await tickAndWrite()
  expect(mock.reads.map(({ lines }) => lines)).toEqual([
    { lines: ['compacted', 'next step'], continued: false },
  ])
  expect(row(RUNNING).activity).toEqual(mockActivity('next step'))
})

test('a large append hands over only the newest window of lines', async () => {
  insertSession(database, { id: RUNNING })
  const file = transcript('running', '')
  mock.open(RUNNING, 'running', file)
  await tickAndWrite()
  appendFileSync(file, `${'old line\n'.repeat(20_000)}newest\n`)
  await tickAndWrite()
  const [read] = mock.reads
  expect(read?.lines.continued).toBe(false)
  expect(read?.lines.lines.at(-1)).toBe('newest')
  expect(read?.lines.lines.length).toBeLessThan(20_000)
  expect(row(RUNNING).activity).toEqual(mockActivity('newest'))
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
  appendFileSync(file, 'bun test\n')
  await tickAndWrite()
  expect(mock.reads).toEqual([])
  expect(row(RUNNING)).toMatchObject({ status: 'idle', activity: null })
})

test('a status the lines settle outranks the listed one', async () => {
  insertSession(database, { id: RUNNING })
  const file = transcript('running', '')
  mock.open(RUNNING, 'unknown', file)
  await tickAndWrite()
  appendFileSync(file, 'status:running\n')
  await tickAndWrite()
  expect(row(RUNNING).status).toBe('running')
  appendFileSync(file, 'status:idle\n')
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
  appendFileSync(file, 'bun test\n')
  await tickAndWrite()
  expect(row(RUNNING).status).toBe('running')
})

test('each Session has one read in flight, and lines that arrive during it are read once after', async () => {
  insertSession(database, { id: RUNNING })
  const file = transcript('running', '')
  mock.open(RUNNING, 'running', file)
  await tickAndWrite()
  const settle: ((reading: TranscriptReading) => void)[] = []
  mock.answerWith(() => new Promise((resolve) => settle.push(resolve)))
  appendFileSync(file, 'first\n')
  await roster.tick()
  appendFileSync(file, 'second\n')
  await roster.tick()
  appendFileSync(file, 'third\n')
  await roster.tick()
  expect(mock.reads.map(({ lines }) => lines.lines)).toEqual([['first']])
  settle.shift()?.({ activity: mockActivity('first'), status: null })
  await new Promise((resolve) => setImmediate(resolve))
  expect(mock.reads.map(({ lines }) => lines.lines)).toEqual([['first'], ['second', 'third']])
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
  appendFileSync(file, 'first\n')
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

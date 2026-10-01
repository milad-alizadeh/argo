import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ExternalSessionPoll } from '@/domains/sessions/main/api'
import { mockClaudeAgentsCli } from '@/mocks/cli/claude/mock-claude-agents'
import { insertSession, liveSession, sessionListCaller } from '@/mocks/sessions/session-list-caller'
import { createClaudeExternalSessions } from './claude-external-sessions'

const IDLE = '00000000-0000-4000-8000-0000000000a1'
const BUSY = '00000000-0000-4000-8000-0000000000a2'
const WAITING = '00000000-0000-4000-8000-0000000000a3'
const STORED_LINE = { label: 'Stored line', kind: 'command', open: true } as const

let agents: ReturnType<typeof mockClaudeAgentsCli>
let caller: ReturnType<typeof sessionListCaller>
let poll: ExternalSessionPoll
let discovered: string[]
// The Sessions Argo runs, by Session ID.
let liveActors: Record<string, unknown>

beforeEach(() => {
  agents = mockClaudeAgentsCli()
  liveActors = {}
  caller = sessionListCaller({ sessions: liveActors })
  discovered = []
  poll = new ExternalSessionPoll({
    database: caller.database,
    changes: caller.sessionListChanges,
    harnesses: [{ harness: 'claude', external: createClaudeExternalSessions(agents.executable) }],
    hasLiveChannel: (sessionId) => Object.hasOwn(liveActors, sessionId),
    discover: ({ nativeId }) => discovered.push(nativeId),
    refreshFeed: () => {},
  })
})

afterEach(() => {
  poll.stop()
  caller.stopWatching()
  caller.database.$client.close()
  agents.dispose()
  vi.restoreAllMocks()
})

function saved(id: string, values: { status?: 'idle' | 'running'; activity?: string } = {}) {
  insertSession(caller.database, { id, harness: 'claude', nativeId: id, ...values })
}

async function tickAndWrite() {
  await poll.tick()
  poll.flush()
}

// What the Session List shows for one row.
async function rowOf(id: string) {
  const row = (await caller.list({ projectId: 'project-1' })).rows.find((each) => each.id === id)
  return { status: row?.status, activity: row?.activity ?? null }
}

const quietWarnings = () => vi.spyOn(console, 'warn').mockImplementation(() => {})

test('the recorded idle, busy and waiting Sessions show idle, running and asking', async () => {
  for (const id of [IDLE, BUSY, WAITING]) saved(id, { status: 'running' })
  agents.answer(agents.recorded())
  await tickAndWrite()
  expect([
    (await rowOf(IDLE)).status,
    (await rowOf(BUSY)).status,
    (await rowOf(WAITING)).status,
  ]).toEqual(['idle', 'running', 'asking'])
})

test.each([
  ['permission prompt', 'permission'],
  ['sandbox request', 'permission'],
  ['worker request', 'permission'],
  ['input needed', 'asking'],
  ['dialog open', 'asking'],
] as const)('a Session waiting for a %s shows %s', async (waitingFor, status) => {
  saved(WAITING)
  const entry = agents.recorded().find(({ sessionId }) => sessionId === WAITING)
  agents.answer([{ ...entry, waitingFor }])
  await tickAndWrite()
  expect((await rowOf(WAITING)).status).toBe(status)
})

test('an undocumented status or waitingFor shows unknown and is counted', async () => {
  const warn = quietWarnings()
  saved(IDLE)
  saved(WAITING)
  const [idle, , waiting] = agents.recorded()
  agents.answer([
    { ...idle, status: 'sleeping' },
    { ...waiting, waitingFor: 'a new kind of wait' },
  ])
  await tickAndWrite()
  expect([(await rowOf(IDLE)).status, (await rowOf(WAITING)).status]).toEqual([
    'unknown',
    'unknown',
  ])
  expect(warn).toHaveBeenCalledWith('Rejected 2 unrecognised claude live Session record(s).')
})

test('an entry of an unknown shape is rejected and counted, and a background Session is not listed', async () => {
  const warn = quietWarnings()
  const background = agents.recorded()[3]
  agents.answer([{ kind: 'interactive', status: 'busy' }, background])
  await tickAndWrite()
  expect(discovered).toEqual([])
  expect(warn).toHaveBeenCalledWith('Rejected 1 unrecognised claude live Session record(s).')
})

test('several entries for one Session show the most urgent', async () => {
  saved(BUSY)
  const busy = agents.recorded()[1]
  agents.answer([
    { ...busy, status: 'idle' },
    busy,
    { ...busy, status: 'waiting', waitingFor: 'permission prompt' },
  ])
  await tickAndWrite()
  expect((await rowOf(BUSY)).status).toBe('permission')
})

test('the listing gives no line: a busy Session keeps its stored line, and shows idle once it leaves', async () => {
  saved(BUSY, { activity: JSON.stringify(STORED_LINE) })
  agents.answer(agents.recorded())
  await tickAndWrite()
  expect(await rowOf(BUSY)).toEqual({
    status: 'running',
    activity: STORED_LINE,
  })
  agents.answer([])
  await tickAndWrite()
  expect((await rowOf(BUSY)).status).toBe('idle')
})

test('a busy Session stays running past the quiet limit, since every listing is fresh', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  saved(BUSY)
  agents.answer(agents.recorded())
  await tickAndWrite()
  vi.setSystemTime(Date.now() + 10 * 60_000)
  await tickAndWrite()
  vi.useRealTimers()
  expect((await rowOf(BUSY)).status).toBe('running')
})

test('a listed Session with no row is discovered', async () => {
  agents.answer(agents.recorded())
  await tickAndWrite()
  expect(discovered.sort()).toEqual([IDLE, BUSY, WAITING])
})

test('a failing or unreadable listing keeps every row as it is, and is reported once', async () => {
  const warn = quietWarnings()
  saved(BUSY)
  agents.answer(agents.recorded())
  await tickAndWrite()
  agents.fail()
  await tickAndWrite()
  agents.answer('not json')
  await tickAndWrite()
  expect((await rowOf(BUSY)).status).toBe('running')
  expect(warn).toHaveBeenCalledTimes(1)
  agents.answer(agents.recorded())
  await tickAndWrite()
  agents.fail()
  await tickAndWrite()
  expect(warn).toHaveBeenCalledTimes(2)
})

test('a Session Argo runs shows its live channel, and the listing writes nothing for it', async () => {
  saved(WAITING, { status: 'idle' })
  const line = {
    label: 'Live line',
    kind: 'command',
    open: true,
  } as const
  liveActors[WAITING] = liveSession('Sending', 'running', line)
  agents.answer(agents.recorded().filter(({ sessionId }) => sessionId === WAITING))
  await tickAndWrite()
  expect(await rowOf(WAITING)).toMatchObject({
    status: 'running',
    activity: { label: 'Live line' },
  })
  expect(discovered).toEqual([])
  delete liveActors[WAITING]
  expect((await rowOf(WAITING)).status).toBe('idle')
})

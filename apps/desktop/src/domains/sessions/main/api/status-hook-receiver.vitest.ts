import { createServer, request } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { installStatusHooks, STATUS_HOOK_EVENTS } from '@/harnesses/host/status-hooks'
import type { ExternalSessionHooks, LiveExternalSession } from '@/harnesses/registration'
import { postHook } from '@/mocks/cli/status-hooks'
import { insertSession, liveSession, sessionListCaller } from '@/mocks/sessions/session-list-caller'
import { ExternalSessionPoll, RUNNING_QUIET_LIMIT_MS } from './external-session-poll'
import { StatusHookReceiver } from './status-hook-receiver'

const SESSION = '00000000-0000-4000-8000-0000000000b1'
const OTHER = '00000000-0000-4000-8000-0000000000b2'

// One Harness whose hooks keep their table in memory, and whose listing returns `listed`.
function stubHarness() {
  const state = {
    table: undefined as Record<string, unknown> | undefined,
    unreadable: false,
    listed: [] as LiveExternalSession[],
    listing: Promise.resolve(),
  }
  const hooks: ExternalSessionHooks = {
    async open() {
      if (state.unreadable) throw new Error('The config cannot be read.')
      return {
        table: state.table,
        write: async (changes) => {
          state.table = { ...state.table, ...Object.fromEntries(changes) }
        },
      }
    },
    events: STATUS_HOOK_EVENTS,
    group: (command) => ({ command }),
    questionTool: 'ask',
    activityTool: { name: 'shell', input: z.looseObject({ command: z.string().optional() }) },
  }
  const external = {
    listLive: async () => {
      const sessions = state.listed
      await state.listing
      return { sessions, rejected: 0 }
    },
    hooks,
  }
  return { state, hooks, external }
}

let harness: ReturnType<typeof stubHarness>
let caller: ReturnType<typeof sessionListCaller>
let liveActors: Record<string, unknown>
let discovered: string[]
let poll: ExternalSessionPoll
let receiver: StatusHookReceiver

beforeEach(() => {
  harness = stubHarness()
  liveActors = {}
  caller = sessionListCaller({ sessions: liveActors })
  discovered = []
  poll = new ExternalSessionPoll({
    database: caller.database,
    changes: caller.sessionListChanges,
    harnesses: [{ harness: 'claude', external: harness.external }],
    hasLiveChannel: (sessionId) => Object.hasOwn(liveActors, sessionId),
    discover: ({ nativeId }) => discovered.push(nativeId),
  })
  receiver = new StatusHookReceiver({
    poll,
    harnesses: [{ harness: 'claude', external: harness.external }],
  })
})

afterEach(() => {
  receiver.stop()
  poll.stop()
  vi.useRealTimers()
  vi.restoreAllMocks()
  caller.stopWatching()
  caller.database.$client.close()
})

const saved = (id = SESSION) =>
  insertSession(caller.database, { id, harness: 'claude', nativeId: id, status: 'idle' })

async function row(id = SESSION) {
  const found = (await caller.list({ projectId: 'project-1' })).rows.find((each) => each.id === id)
  return { status: found?.status, activity: found?.activity?.label ?? null }
}

// Posts one event as the installed hook does and writes what it queued.
async function post(event: string, id = SESSION, tool?: string) {
  const payload = tool === undefined ? { session_id: id } : { session_id: id, tool_name: tool }
  const status = await postHook(receiver.port, 'claude', { event, payload })
  poll.flush()
  return status
}

// The listing names the Sessions running, and one tick writes what it shows.
async function listedRunning(...ids: string[]) {
  harness.state.listed = ids.map((nativeId) => ({ nativeId, status: 'running', transcript: null }))
  await poll.tick()
  poll.flush()
}

async function atQuietLimit(now: number) {
  vi.spyOn(Date, 'now').mockReturnValue(now + RUNNING_QUIET_LIMIT_MS)
  await poll.tick()
  poll.flush()
}

const quietWarnings = () => vi.spyOn(console, 'warn').mockImplementation(() => {})

test('a hook event for a Session Argo does not list writes nothing, and only its start asks to find it', async () => {
  await receiver.start()
  saved()
  for (const event of ['SessionStart', 'UserPromptSubmit', 'Stop'])
    expect(await post(event, OTHER)).toBe(204)
  expect(discovered).toEqual([OTHER])
  expect((await caller.list({ projectId: 'project-1' })).rows.map(({ id }) => id)).toEqual([
    SESSION,
  ])
})

test('a live Argo channel wins over hook data for the same Session', async () => {
  await receiver.start()
  saved()
  liveActors[SESSION] = liveSession('Sending', 'running')
  await post('PermissionRequest', SESSION, 'shell')
  expect(await row()).toEqual({ status: 'running', activity: null })
  delete liveActors[SESSION]
  expect(await row()).toEqual({ status: 'idle', activity: null })
})

test('a payload of an unknown shape or event is rejected, reported and counted', async () => {
  await receiver.start()
  saved()
  const warn = quietWarnings()
  const sent = (event: string, payload: unknown) =>
    postHook(receiver.port, 'claude', { event, payload })
  expect(await sent('Stop', { turn_id: 'no session' })).toBe(400)
  expect(await sent('Stop', 'not json')).toBe(400)
  expect(await sent('Notification', { session_id: SESSION })).toBe(400)
  expect(await sent('PreToolUse', { session_id: SESSION })).toBe(400)
  expect(await post('UserPromptSubmit')).toBe(204)
  expect(warn).toHaveBeenLastCalledWith('Rejected 4 unrecognised status hook event(s).')
  expect((await row()).status).toBe('running')
})

test('the poll gives the status until the hooks fire, and is off once they do', async () => {
  await receiver.start()
  saved()
  await listedRunning(SESSION)
  expect((await row()).status).toBe('running')

  await post('Stop')
  expect((await row()).status).toBe('idle')
  saved(OTHER)
  await listedRunning(SESSION, OTHER)
  expect([(await row()).status, (await row(OTHER)).status]).toEqual(['idle', 'idle'])
})

test('hooks from Argo’s own probes and Sessions leave the poll on', async () => {
  await receiver.start()
  saved()
  await listedRunning(SESSION)
  await post('SessionStart', OTHER)
  saved(OTHER)
  liveActors[OTHER] = liveSession('Sending', 'running')
  await post('Stop', OTHER)
  await listedRunning()
  expect((await row()).status).toBe('idle')
})

test('a permission row with no event for the quiet limit shows unknown, since Esc sends none', async () => {
  await receiver.start()
  saved()
  await poll.tick()
  const now = Date.now()
  vi.spyOn(Date, 'now').mockReturnValue(now)
  await post('PermissionRequest', SESSION, 'shell')
  expect((await row()).status).toBe('permission')
  await atQuietLimit(now)
  expect((await row()).status).toBe('unknown')
})

test('an asking row is not timed out by the quiet limit', async () => {
  await receiver.start()
  saved()
  await poll.tick()
  const now = Date.now()
  vi.spyOn(Date, 'now').mockReturnValue(now)
  await post('PreToolUse', SESSION, 'ask')
  expect((await row()).status).toBe('asking')
  await atQuietLimit(now)
  expect((await row()).status).toBe('asking')
})

test('a config Argo cannot read is not written, the failure is counted, and the poll stays on', async () => {
  harness.state.unreadable = true
  const warn = quietWarnings()
  await receiver.start()
  expect(warn).toHaveBeenCalledWith(
    'Could not install the claude status hooks (1 failure(s)):',
    expect.any(Error),
  )
  expect(harness.state.table).toBeUndefined()
  saved()
  await listedRunning(SESSION)
  expect((await row()).status).toBe('running')
})

test('a port the hooks name that another Argo holds is left to it, and this one stays on the poll', async () => {
  const other = createServer()
  await new Promise<void>((resolve) => other.listen(0, '127.0.0.1', resolve))
  try {
    await installStatusHooks('claude', harness.hooks, (other.address() as AddressInfo).port)
    const before = structuredClone(harness.state.table)
    quietWarnings()
    await receiver.start()
    expect(receiver.port).toBe(0)
    expect(harness.state.table).toEqual(before)
    saved()
    await listedRunning(SESSION)
    expect((await row()).status).toBe('running')
  } finally {
    other.close()
  }
})

test('a stop before the start finishes leaves nothing listening and installs nothing', async () => {
  const starting = receiver.start()
  receiver.stop()
  await starting
  expect(receiver.port).toBe(0)
  expect(harness.state.table).toBeUndefined()
})

// Posts as a browser page or a rebound DNS name would, with its own headers.
function postWithHeaders(headers: Record<string, string>): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const sent = request(
      {
        host: '127.0.0.1',
        port: receiver.port,
        method: 'POST',
        path: '/h/claude/UserPromptSubmit',
        headers,
      },
      (response) => resolve(response.statusCode),
    )
    sent.on('error', reject)
    sent.end(JSON.stringify({ session_id: SESSION }))
  })
}

test('a post with an Origin or a Host other than the loopback port is rejected', async () => {
  await receiver.start()
  saved()
  quietWarnings()
  expect(await postWithHeaders({ Origin: 'https://example.com' })).toBe(400)
  expect(await postWithHeaders({ Host: `attacker.example:${receiver.port}` })).toBe(400)
  poll.flush()
  expect((await row()).status).toBe('idle')
  expect(await postWithHeaders({})).toBe(204)
})

test('a PreToolUse that lands after its PermissionRequest keeps permission', async () => {
  await receiver.start()
  saved()
  await post('UserPromptSubmit')
  await post('PermissionRequest', SESSION, 'shell')
  await post('PreToolUse', SESSION, 'shell')
  expect(await row()).toEqual({ status: 'permission', activity: 'shell' })
  await post('PostToolUse', SESSION, 'shell')
  expect((await row()).status).toBe('running')
})

test('a Session listed before the hooks fire keeps its status once they do, until the quiet limit', async () => {
  await receiver.start()
  saved()
  saved(OTHER)
  await listedRunning(SESSION)
  const now = Date.now()
  vi.spyOn(Date, 'now').mockReturnValue(now)
  await post('Stop', OTHER)
  await poll.tick()
  poll.flush()
  expect((await row()).status).toBe('running')
  await atQuietLimit(now)
  expect((await row()).status).toBe('unknown')
})

test('a hook event during the first listing is not reset by that listing', async () => {
  let finishListing = () => {}
  harness.state.listing = new Promise<void>((resolve) => (finishListing = resolve))
  await receiver.start()
  saved()
  const listing = poll.tick()
  await post('UserPromptSubmit')
  expect((await row()).status).toBe('running')
  finishListing()
  await listing
  poll.flush()
  expect((await row()).status).toBe('running')
})

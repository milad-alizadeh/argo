import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { STATUS_HOOK_EVENTS } from '@/harnesses/host/status-hooks'
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
let folder: string
let socketPath: string

beforeEach(() => {
  folder = mkdtempSync(path.join(os.tmpdir(), 'argo-hooks-'))
  socketPath = path.join(folder, 'hooks.sock')
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
    socketPath,
  })
})

afterEach(() => {
  receiver.stop()
  poll.stop()
  vi.useRealTimers()
  vi.restoreAllMocks()
  caller.stopWatching()
  caller.database.$client.close()
  rmSync(folder, { recursive: true, force: true })
})

const saved = (id = SESSION) =>
  insertSession(caller.database, { id, harness: 'claude', nativeId: id, status: 'idle' })

async function row(id = SESSION) {
  const found = (await caller.list({ projectId: 'project-1' })).rows.find((each) => each.id === id)
  return { status: found?.status, activity: found?.activity?.label ?? null }
}

// Posts one event as the installed hook does and writes what it queued.
async function post(event: string, id = SESSION, tool?: string) {
  const payload = { hook_event_name: event, session_id: id, tool_name: tool }
  const status = await postHook(socketPath, 'claude', payload)
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
  const sent = (payload: unknown, harnessName = 'claude') =>
    postHook(socketPath, harnessName, payload)
  expect(await sent({ hook_event_name: 'Stop', turn_id: 'no session' })).toBe(400)
  expect(await sent('not json')).toBe(400)
  expect(await sent({ hook_event_name: 'Notification', session_id: SESSION })).toBe(400)
  expect(await sent({ session_id: SESSION })).toBe(400)
  expect(await sent({ hook_event_name: 'PreToolUse', session_id: SESSION })).toBe(400)
  expect(await sent({ hook_event_name: 'Stop', session_id: SESSION }, 'codex')).toBe(400)
  expect(await post('UserPromptSubmit')).toBe(204)
  expect(warn).toHaveBeenLastCalledWith('Rejected 6 unrecognised status hook event(s).')
  expect((await row()).status).toBe('running')
})

test('a permission row with no event for the quiet limit shows unknown, since Esc sends none', async () => {
  await receiver.start()
  saved()
  await listedRunning(SESSION)
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
  await listedRunning(SESSION)
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

test('a stop before the start finishes leaves nothing listening and installs nothing', async () => {
  const starting = receiver.start()
  receiver.stop()
  await starting
  expect(existsSync(socketPath)).toBe(false)
  expect(harness.state.table).toBeUndefined()
})

test('a PreToolUse that lands after its PermissionRequest keeps permission', async () => {
  await receiver.start()
  saved()
  await listedRunning(SESSION)
  await post('UserPromptSubmit')
  await post('PermissionRequest', SESSION, 'shell')
  await post('PreToolUse', SESSION, 'shell')
  expect(await row()).toEqual({ status: 'permission', activity: 'shell' })
  await post('PostToolUse', SESSION, 'shell')
  expect((await row()).status).toBe('running')
})

test('a hook status outranks the listed one on later ticks', async () => {
  await receiver.start()
  saved()
  await listedRunning(SESSION)
  await post('Stop')
  await listedRunning(SESSION)
  expect((await row()).status).toBe('idle')
})

test('a socket left by an Argo that did not close is replaced', async () => {
  writeFileSync(socketPath, '')
  await receiver.start()
  saved()
  expect(await post('UserPromptSubmit')).toBe(204)
})

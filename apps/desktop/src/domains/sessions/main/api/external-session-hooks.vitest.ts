import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createClaudeExternalSessions } from '@/harnesses/claude/session'
import type { CodexAppServerClient } from '@/harnesses/codex/app-server'
import { createCodexExternalSessions } from '@/harnesses/codex/session'
import { mockClaudeAgentsCli } from '@/mocks/cli/claude/mock-claude-agents'
import { clientBackedByMock, writeMockCodex } from '@/mocks/cli/codex/mock-codex-driver'
import { guardRealUserConfig, isolateHarnessFolders } from '@/mocks/cli/real-user-config'
import { hookEvent, hookTurn, postHook } from '@/mocks/cli/status-hooks'
import { insertSession, liveSession, sessionListCaller } from '@/mocks/sessions/session-list-caller'
import { ExternalSessionHooks } from './external-session-hooks'
import { ExternalSessionPoll, RUNNING_QUIET_LIMIT_MS } from './external-session-poll'

const SESSION = '00000000-0000-4000-8000-0000000000b1'
const OTHER = '00000000-0000-4000-8000-0000000000b2'
const HARNESSES = ['claude', 'codex'] as const
type HookHarness = (typeof HARNESSES)[number]

const realConfigUnchanged = guardRealUserConfig()
afterAll(realConfigUnchanged)

let root: string
let restoreFolders: () => void
let agents: ReturnType<typeof mockClaudeAgentsCli>
let codex: CodexAppServerClient
let caller: ReturnType<typeof sessionListCaller>
let liveActors: Record<string, unknown>
let discovered: string[]
let poll: ExternalSessionPoll
let receiver: ExternalSessionHooks

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'argo-status-hooks-'))
  restoreFolders = isolateHarnessFolders(root)
  agents = mockClaudeAgentsCli()
  codex = clientBackedByMock(
    await writeMockCodex(root, { CODEX_HOME: process.env.CODEX_HOME as string }),
  )
  liveActors = {}
  caller = sessionListCaller({ sessions: liveActors })
  discovered = []
})

afterEach(async () => {
  receiver?.stop()
  poll?.stop()
  vi.useRealTimers()
  vi.restoreAllMocks()
  codex.shutdown()
  agents.dispose()
  caller.stopWatching()
  caller.database.$client.close()
  restoreFolders()
  await rm(root, { recursive: true, force: true })
})

async function start() {
  const harnesses = [
    { harness: 'claude' as const, external: createClaudeExternalSessions(agents.executable) },
    {
      harness: 'codex' as const,
      external: createCodexExternalSessions(codex.request, process.env.CODEX_HOME as string),
    },
  ]
  poll = new ExternalSessionPoll({
    database: caller.database,
    changes: caller.sessionListChanges,
    harnesses,
    hasLiveChannel: (sessionId) => Object.hasOwn(liveActors, sessionId),
    discover: ({ nativeId }) => discovered.push(nativeId),
  })
  receiver = new ExternalSessionHooks({ poll, harnesses })
  await receiver.start()
}

const saved = (harness: HookHarness, id = SESSION) =>
  insertSession(caller.database, { id, harness, nativeId: id, status: 'idle' })

async function row(id = SESSION) {
  const found = (await caller.list({ projectId: 'project-1' })).rows.find((each) => each.id === id)
  return { status: found?.status, activity: found?.activity?.label ?? null }
}

// Posts one event as the installed hook does and writes what it queued.
async function post(harness: HookHarness, event: { event: string; payload: unknown }) {
  const status = await postHook(receiver.port, harness, event)
  poll.flush()
  return status
}

const quietWarnings = () => vi.spyOn(console, 'warn').mockImplementation(() => {})

// The Claude listing names the Session busy, and one tick writes what it shows.
async function listedRunning(...ids: string[]) {
  const busy = agents.recorded()[1]
  agents.answer(ids.map((sessionId) => ({ ...busy, sessionId })))
  await poll.tick()
  poll.flush()
}

test.each(HARNESSES)('each %s event sets the status and the activity line', async (harness) => {
  await start()
  saved(harness)
  const seen: { event: string; status: string | undefined; activity: string | null }[] = []
  for (const event of hookTurn(harness, 'bashTurn', SESSION)) {
    await post(harness, event)
    seen.push({ event: event.event, ...(await row()) })
  }
  const line = harness === 'claude' ? 'Run test suite' : 'Ran touch b.txt'
  expect(seen).toEqual([
    { event: 'SessionStart', status: 'idle', activity: null },
    { event: 'UserPromptSubmit', status: 'running', activity: null },
    { event: 'PreToolUse', status: 'running', activity: line },
    { event: 'PermissionRequest', status: 'permission', activity: line },
    { event: 'PostToolUse', status: 'running', activity: line },
    { event: 'Stop', status: 'idle', activity: line },
    { event: 'SessionEnd', status: 'idle', activity: line },
  ])
})

test.each(HARNESSES)('a %s question to the person shows asking', async (harness) => {
  await start()
  saved(harness)
  const statuses: (string | undefined)[] = []
  for (const event of hookTurn(harness, 'questionTurn', SESSION)) {
    await post(harness, event)
    statuses.push((await row()).status)
  }
  expect(statuses).toContain('asking')
  expect(statuses.at(-1)).toBe('idle')
})

test.each(HARNESSES)('the %s install names the port Argo listens on', async (harness) => {
  await start()
  const external =
    harness === 'claude'
      ? createClaudeExternalSessions(null)
      : createCodexExternalSessions(codex.request, process.env.CODEX_HOME as string)
  expect(await external.hooks?.installedPort()).toBe(receiver.port)
})

test('a hook event for a Session Argo does not list writes nothing, and only its start asks to find it', async () => {
  await start()
  saved('claude')
  for (const event of hookTurn('claude', 'bashTurn', OTHER))
    expect(await post('claude', event)).toBe(204)
  expect(discovered).toEqual([OTHER])
  expect((await caller.list({ projectId: 'project-1' })).rows.map(({ id }) => id)).toEqual([
    SESSION,
  ])
})

test('a live Argo channel wins over hook data for the same Session', async () => {
  await start()
  saved('claude')
  liveActors[SESSION] = liveSession('Sending', 'running')
  await post('claude', hookEvent('claude', 'PermissionRequest', SESSION))
  await post('claude', hookEvent('claude', 'PreToolUse', SESSION))
  expect(await row()).toEqual({ status: 'running', activity: null })
  delete liveActors[SESSION]
  expect(await row()).toEqual({ status: 'idle', activity: null })
})

test('a payload of an unknown shape or event is rejected, reported and counted', async () => {
  await start()
  saved('codex')
  const warn = quietWarnings()
  expect(await post('codex', { event: 'Stop', payload: { turn_id: 'no session' } })).toBe(400)
  expect(await post('codex', { event: 'Stop', payload: 'not json' })).toBe(400)
  expect(await post('codex', { event: 'Notification', payload: { session_id: SESSION } })).toBe(400)
  expect(await post('codex', hookEvent('codex', 'UserPromptSubmit', SESSION))).toBe(204)
  expect(warn).toHaveBeenLastCalledWith('Rejected 3 unrecognised status hook event(s).')
  expect((await row()).status).toBe('running')
})

test('the poll gives the status until the hooks fire, and is off once they do', async () => {
  await start()
  saved('claude')
  await listedRunning(SESSION)
  expect((await row()).status).toBe('running')

  await post('claude', hookEvent('claude', 'Stop', SESSION))
  expect((await row()).status).toBe('idle')
  saved('claude', OTHER)
  await listedRunning(SESSION, OTHER)
  expect([(await row()).status, (await row(OTHER)).status]).toEqual(['idle', 'idle'])
})

test('a permission row with no event for the quiet limit shows unknown, since Esc sends none', async () => {
  await start()
  saved('codex')
  await poll.tick()
  const now = Date.now()
  vi.spyOn(Date, 'now').mockReturnValue(now)
  await post('codex', hookEvent('codex', 'PermissionRequest', SESSION))
  expect((await row()).status).toBe('permission')
  vi.spyOn(Date, 'now').mockReturnValue(now + RUNNING_QUIET_LIMIT_MS)
  await poll.tick()
  poll.flush()
  expect((await row()).status).toBe('unknown')
})

test('settings Argo cannot parse are not written, the failure is counted, and the poll stays on', async () => {
  const settings = path.join(process.env.CLAUDE_CONFIG_DIR as string, 'settings.json')
  await mkdir(path.dirname(settings), { recursive: true })
  await writeFile(settings, '{ "hooks": ')
  const warn = quietWarnings()
  await start()
  expect(await readFile(settings, 'utf8')).toBe('{ "hooks": ')
  expect(warn).toHaveBeenCalledWith(
    'Could not install the claude status hooks (1 failure(s)):',
    expect.any(Error),
  )
  saved('claude')
  await listedRunning(SESSION)
  expect((await row()).status).toBe('running')
})

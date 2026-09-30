import assert from 'node:assert/strict'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, test } from 'vitest'
import { watchHistoryActivity } from '@/harnesses/host/history-watch'
import { createHarnessRegistry } from '@/harnesses/registry'
import { MOCK_HISTORY_LINES, type MockHistoryLines } from '@/mocks/sessions/mock-history-lines'
import { IDS, insertSession, sessionListCaller } from '@/mocks/sessions/session-list-caller'
import { codexClientFor } from '@/mocks/sessions/live-session-supervisor.fixture'
import { SessionActivities } from './session-activities'
import { updateSession } from './session-update'

const WRITE_MS = 20
const NATIVE_ID = '0a0b0c0d-0000-4000-8000-000000000001'
const PROBE_ID = '0a0b0c0d-0000-4000-8000-00000000000f'

const registry = createHarnessRegistry(
  codexClientFor(async () => {
    throw new Error('A watched Session must not reach the app-server.')
  }, new Set()),
)

const stops: (() => Promise<void> | void)[] = []
afterEach(async () => {
  for (const stop of stops.splice(0).reverse()) await stop()
})

async function eventually<T>(read: () => Promise<T | undefined>, timeoutMs = 5_000): Promise<T> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await read()
    if (value !== undefined) return value
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('The Session List never drew the expected activity.')
}

function append(file: string, lines: readonly string[]) {
  mkdirSync(path.dirname(file), { recursive: true })
  appendFileSync(file, `${lines.join('\n')}\n`)
}

// One saved external Session whose history file the app's watcher reads, with no Feed reader.
async function watchedSession(harness: keyof typeof MOCK_HISTORY_LINES) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-session-activities-'))
  stops.push(() => rm(root, { recursive: true, force: true }))
  const files = registry[harness].historyFiles
  if (files === undefined) throw new Error(`${harness} writes no history files.`)
  const { database, list, sessionListChanges, stopWatching } = sessionListCaller()
  stops.push(() => database.$client.close())
  stops.push(stopWatching)
  insertSession(database, { id: IDS[0], harness, nativeId: NATIVE_ID })
  const lines: MockHistoryLines = MOCK_HISTORY_LINES[harness]()
  const file = lines.file(root, NATIVE_ID)
  append(file, lines.prompt('Check the suite'))

  let activities = new SessionActivities({ database, changes: sessionListChanges }, WRITE_MS)
  const owners = new Set<string>()
  const stopHistory = watchHistoryActivity({ ...files, directory: root }, (owner, _turn, reading) => {
    owners.add(owner)
    activities.publish({ harness, nativeId: owner }, reading)
  })
  stops.push(() => {
    stopHistory()
    activities.stop()
  })
  // The platform watcher starts late; a probe Session it reports proves it is live. Each probe
  // waits out the watcher's settle window, which a sooner write would restart.
  const probe = MOCK_HISTORY_LINES[harness]()
  for (let attempt = 0; !owners.has(PROBE_ID); attempt += 1) {
    if (attempt === 25) throw new Error('The history watcher never started.')
    append(probe.file(root, PROBE_ID), probe.prompt(`probe ${attempt}`))
    await new Promise((resolve) => setTimeout(resolve, 400))
  }

  const activity = async () => (await list({ projectId: 'project-1' })).rows[0]?.activity ?? null
  const shows = (label: string) =>
    eventually(async () => {
      const current = await activity()
      return current?.label === label ? current : undefined
    })
  const restart = () => {
    activities.stop()
    activities = new SessionActivities({ database, changes: sessionListChanges }, WRITE_MS)
  }
  return { file, lines, activity, shows, restart }
}

const HARNESSES = Object.keys(MOCK_HISTORY_LINES) as (keyof typeof MOCK_HISTORY_LINES)[]

// Each case waits on the platform file watcher, which can take seconds to start.
describe.each(HARNESSES)('an external %s Session', { timeout: 20_000 }, (harness) => {
  test('updates its activity line as it runs, with no Feed open', async () => {
    const session = await watchedSession(harness)

    append(session.file, session.lines.command('bun test'))
    const first = await session.shows('Ran bun test')
    append(session.file, session.lines.command('bun run lint'))
    await session.shows('Ran bun run lint')

    assert.deepEqual(first, {
      label: 'Ran bun test',
      kind: 'command',
      open: false,
      tool: 'command',
      target: null,
    })
  })

  test('keeps its stored line once idle, across a restart and a record with no content', async () => {
    const session = await watchedSession(harness)
    append(session.file, session.lines.command('bun test'))
    await session.shows('Ran bun test')

    append(session.file, session.lines.answer('The suite passes.'))
    session.restart()
    append(session.file, [session.lines.bookkeeping()])
    await new Promise((resolve) => setTimeout(resolve, 600))

    assert.equal((await session.activity())?.label, 'Ran bun test')
  })

  test('reads a rewritten or truncated file afresh', async () => {
    const session = await watchedSession(harness)
    append(session.file, session.lines.command('bun test'))
    await session.shows('Ran bun test')

    writeFileSync(session.file, '')
    append(session.file, [...session.lines.prompt('Start over'), ...session.lines.command('ls')])

    await session.shows('Ran ls')
  })

  test('reads a large append from its tail alone', async () => {
    const session = await watchedSession(harness)
    append(session.file, session.lines.command('bun test'))
    await session.shows('Ran bun test')

    const filler = Array.from({ length: 4_000 }, () => session.lines.bookkeeping())
    const reply = session.lines.answer('x'.repeat(200 * 1024))
    append(session.file, [...filler, ...reply, ...session.lines.command('git status')])

    await session.shows('Ran git status')
  })
})

test('writes a burst of activity once, as its newest value', async () => {
  const { database, list, sessionListChanges, stopWatching } = sessionListCaller()
  stops.push(() => database.$client.close())
  stops.push(stopWatching)
  insertSession(database, { id: IDS[0], harness: 'claude', nativeId: NATIVE_ID })
  const announced: (readonly string[])[] = []
  stops.push(sessionListChanges.subscribe((sessionIds) => announced.push(sessionIds)))
  const activities = new SessionActivities({ database, changes: sessionListChanges }, WRITE_MS)
  stops.push(() => activities.stop())
  const thought = (text: string) => ({
    restarted: false,
    events: [
      {
        type: 'content' as const,
        commandId: null,
        turnId: null,
        vendorEventId: text,
        content: { kind: 'reasoning' as const, id: text, text, redacted: false },
      },
    ],
  })

  for (const text of ['one', 'two', 'three'])
    activities.publish({ harness: 'claude', nativeId: NATIVE_ID }, thought(text))
  const before = (await list({ projectId: 'project-1' })).rows[0]?.activity
  await new Promise((resolve) => setTimeout(resolve, WRITE_MS * 3))

  assert.equal(before, null)
  assert.equal((await list({ projectId: 'project-1' })).rows[0]?.activity?.label, 'three')
  assert.deepEqual(announced, [[IDS[0]]])
})

test('draws a live channel’s activity over the stored line', async () => {
  const liveActivity = { label: 'Editing', kind: 'edited', open: true, tool: 'Edit', target: null }
  const session = {
    getSnapshot: () => ({
      value: 'Ready',
      matches: (candidate: string) => candidate === 'Ready',
      context: {
        status: 'running',
        activity: { activity: liveActivity },
        turnConfiguration: { model: null, effort: null, mode: null },
      },
    }),
  }
  const { database, list, sessionListChanges, stopWatching } = sessionListCaller({
    sessions: { [IDS[0]]: session },
  })
  stops.push(() => database.$client.close())
  stops.push(stopWatching)
  insertSession(database, { id: IDS[0], harness: 'claude', nativeId: NATIVE_ID, status: 'idle' })
  updateSession({ database, changes: sessionListChanges }, IDS[0], {
    activity: { label: 'Ran bun test', kind: 'command', open: false },
  })

  const [row] = (await list({ projectId: 'project-1' })).rows

  assert.equal(row?.status, 'running')
  assert.deepEqual(row?.activity, liveActivity)
})

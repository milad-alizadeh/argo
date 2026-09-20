// A minimal third harness, registered only for this test, proves the generalisation #2488 asks
// for: driver setup, observation, drive routing, watcher registration and shutdown all reach a
// harness through its `HarnessRegistration` alone. Nothing here edits `registered-harnesses.ts`
// or any other shared Session file — every shared function used takes its own `harnesses` list.
// `.vitest.ts`, not `.test.ts`: importing `session-bridges.ts` pulls in the real
// `registered-harnesses.ts`, whose Codex harness reaches `node:sqlite` through its thread-name
// store, unavailable under Bun (apps/desktop/AGENTS.md, #2372) even though this test's own fixture
// harness never opens an index.
import assert from 'node:assert/strict'
import { test } from 'vitest'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import type { HarnessRegistration } from '@/domains/sessions/main/composition/harness-registration'
import {
  closeSessionDrivers,
  createSessionDrivers,
  harnessWatchedSources,
} from '@/domains/sessions/main/composition/session-bridges'
import { compactSession, sendSession } from '@/domains/sessions/main/drive/drive'
import type { SessionDriveAdapters } from '@/domains/sessions/main/drive/session-drive-adapter'
import type { SessionIndex } from '@/domains/sessions/main/index/session-index/contract'
import { managedRow } from '@/domains/sessions/main/lifecycle/managed-row'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import { listed } from '@/domains/sessions/main/observation/reader-test-helpers'
import { sessionSources } from '@/domains/sessions/main/observation/session-sources'
import { registerWatching } from '@/platform/main/watch/bridge'
import { WATCHED_CHANGED_CHANNEL } from '@/platform/shared/watch'

const setup = { model: null, effort: null, mode: null } as const

// Never opened: the fixture's `createSource` ignores it, the way a harness with no index-backed
// backfill would (#2373's `backfillTick` stays undefined).
const unusedIndex: SessionIndex = {
  filesAt: async () => [],
  filesOfChains: async () => [],
  rowsOfChains: async () => [],
  searchChains: async () => [],
  chainLinks: async () => [],
  strandedChains: async () => [],
  write: async () => {},
  backfillProgress: async () => ({ boundary: null, complete: true }),
  setBackfillProgress: async () => {},
  close: async () => {},
}

type FixtureDriver = {
  sent: { sessionId: string; prompt: string }[]
  compacted: string[]
  closed: boolean
  rosterChangedListeners: Set<() => void>
  row: SessionRosterRow
}

function fixtureHarness(): { harness: HarnessRegistration<FixtureDriver>; driver: FixtureDriver } {
  const driver: FixtureDriver = {
    sent: [],
    compacted: [],
    closed: false,
    rosterChangedListeners: new Set(),
    row: managedRow('fixture-1', {
      cli: 'fixture',
      cwd: '/proj',
      status: 'running',
      setup,
      prompt: 'Fixture opener.',
      startedAt: '2026-09-14T09:00:00.000Z',
    }),
  }
  const harness: HarnessRegistration<FixtureDriver> = {
    cli: 'fixture',
    createDriver() {
      return driver
    },
    createSource(fixtureDriver) {
      return {
        cli: 'fixture',
        async discoverSessions() {
          return {
            rows: [fixtureDriver.row],
            filesFound: 0,
            filesRead: 0,
            filesUnreadable: 0,
            filesParsed: 0,
            nextCursor: null,
            historyComplete: true,
          }
        },
        managedSessions() {
          return [fixtureDriver.row]
        },
        async readSessionFiles() {
          return null
        },
        async readShellOutput() {
          throw new Error('the fixture harness records no Shell output')
        },
      }
    },
    createDriveAdapter(fixtureDriver) {
      return {
        cli: 'fixture',
        turnSetupSchema: { safeParse: () => ({ success: true as const, data: undefined }) },
        async start() {
          return { sessionId: 'fixture-1' }
        },
        async send({ sessionId, prompt }) {
          fixtureDriver.sent.push({ sessionId, prompt })
          return { ok: true }
        },
        async interrupt() {
          return { ok: true }
        },
        async compact({ sessionId }) {
          fixtureDriver.compacted.push(sessionId)
          return { ok: true }
        },
        async handoff() {
          return { ok: true }
        },
        async readPermission() {
          return { permission: null }
        },
        async decidePermission() {
          return { ok: true }
        },
        async decideQuestion() {
          return { ok: true }
        },
      }
    },
    watchedTranscriptRoots() {
      return []
    },
    async closeDriver(fixtureDriver) {
      fixtureDriver.closed = true
    },
    onRosterChanged(fixtureDriver) {
      return (onChanged) => {
        fixtureDriver.rosterChangedListeners.add(onChanged)
        return () => fixtureDriver.rosterChangedListeners.delete(onChanged)
      }
    },
  }
  return { harness, driver }
}

test('a fixture harness reaches driver setup, observation, drive routing, watcher registration and shutdown', async () => {
  const { harness, driver } = fixtureHarness()
  const harnesses = [harness]

  // Driver setup.
  const drivers = createSessionDrivers('/unused-userData', '/unused-home', false, harnesses)
  assert.equal(drivers.fixture, driver)

  // Observation.
  const sources = sessionSources({
    home: '/unused-home',
    drivers,
    compactionStarts: undefined,
    index: unusedIndex,
    harnesses,
  })
  const reader = createSessionReader(sources)
  const reply = await listed(reader)
  assert.ok(reply?.sessions.some((row) => row.id === 'fixture-1'))

  // Drive routing.
  const adapters: SessionDriveAdapters = { [harness.cli]: harness.createDriveAdapter(driver) }
  const context = { adapters, ownerCliFor: reader.ownerCliFor }
  const sendReply = await sendSession(
    {
      version: 1,
      type: 'session.send',
      requestId: 'send-fixture',
      sessionId: 'fixture-1',
      prompt: 'To fixture.',
    },
    context,
  )
  assert.equal(sendReply.type, 'session.accepted')
  assert.deepEqual(driver.sent, [{ sessionId: 'fixture-1', prompt: 'To fixture.' }])
  const compactReply = await compactSession(
    { version: 1, type: 'session.compact', requestId: 'compact-fixture', sessionId: 'fixture-1' },
    context,
  )
  assert.equal(compactReply.type, 'session.accepted')
  assert.deepEqual(driver.compacted, ['fixture-1'])

  // Watcher registration.
  const watched = harnessWatchedSources(drivers, sources, reader, harnesses)
  assert.equal(watched.sessions.length, 1)
  const sent: unknown[] = []
  const closedListeners: (() => void)[] = []
  const fakeWindow = {
    webContents: { send: (channel: string, topic: unknown) => sent.push([channel, topic]) },
    isDestroyed: () => false,
    on: (event: string, listener: () => void) => {
      if (event === 'closed') closedListeners.push(listener)
    },
  }
  registerWatching(fakeWindow as unknown as Parameters<typeof registerWatching>[0], {
    permissions: watched.permissions,
    sessions: watched.sessions,
  })
  assert.equal(driver.rosterChangedListeners.size, 1)
  for (const listener of driver.rosterChangedListeners) listener()
  assert.deepEqual(sent, [[WATCHED_CHANGED_CHANNEL, 'sessions']])
  for (const listener of closedListeners) listener()

  // Shutdown.
  await closeSessionDrivers(drivers, harnesses)
  assert.equal(driver.closed, true)
})

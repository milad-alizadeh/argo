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
import type { SessionDriveAdapters } from '@/domains/sessions/contract/session-drive-adapter'
import { compactSession, sendSession } from '@/domains/sessions/main/drive/drive'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import { listed } from '@/domains/sessions/main/observation/reader-test-helpers'
import { fixtureHarness, unusedIndex } from '@/harnesses/composition/harness-registration.fixture'
import { harnessWatchedSources } from '@/harnesses/composition/session-bridges'
import { registerWatching } from '@/platform/main/watch/bridge'
import { WATCHED_CHANGED_CHANNEL } from '@/platform/shared/watch'

test('a fixture harness reaches driver setup, observation, drive routing, watcher registration and shutdown', async () => {
  const { harness, driver } = fixtureHarness()
  const harnesses = [harness]

  // Driver setup.
  const runtimes = harnesses.map((harness) =>
    harness.start({
      userData: '/unused-userData',
      home: '/unused-home',
      proofEnabled: false,
      acceptance: false,
      index: unusedIndex,
    }),
  )
  assert.equal(runtimes[0]?.harness, 'fixture')

  // Observation.
  const sources = runtimes.map((runtime) => runtime.source)
  const reader = createSessionReader(sources)
  const reply = await listed(reader)
  assert.ok(reply?.sessions.some((row) => row.id === 'fixture-1'))

  // Drive routing.
  const adapters: SessionDriveAdapters = { [harness.harness]: runtimes[0]!.driveAdapter }
  const context = { adapters, ownerHarnessFor: reader.ownerHarnessFor }
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
  const watched = harnessWatchedSources(runtimes)
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
  await Promise.all(runtimes.map((runtime) => runtime.close()))
  assert.equal(driver.closed, true)
})

import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createActor } from 'xstate'
import { getShortestPaths } from 'xstate/graph'
import type { Database } from '@/database/database'
import { SessionSyncStatusStore } from '@/domains/sessions/main/api/session-sync-status'
import type { HarnessRegistry } from '@/harnesses/registry'
import { createAppMachine } from './app-machine'

const shutdowns: string[] = []
const registry = {
  claude: {},
  codex: { shutdown: () => shutdowns.push('codex') },
} as unknown as HarnessRegistry
const input = {
  database: {} as Database,
  sessionSyncStatus: {
    claude: new SessionSyncStatusStore(undefined, 'claude'),
    codex: new SessionSyncStatusStore(undefined, 'codex'),
  },
}
const appMachine = createAppMachine(registry, input)

test('models application startup and shutdown', () => {
  const paths = getShortestPaths(appMachine, {
    input,
    events: (snapshot) => (snapshot.matches('Running') ? [{ type: 'Shutdown' as const }] : []),
  })
  assert.deepEqual(
    new Set(paths.map(({ state }) => (state.matches('Running') ? 'Running' : 'Closed'))),
    new Set(['Running', 'Closed']),
  )
})

test('owns catalog, live and sync Session supervisors, and shared Harness clients until shutdown', () => {
  const actor = createActor(appMachine, { input }).start()
  const catalog = actor.system.get('catalog')
  const sessions = actor.system.get('sessions')
  const sessionSync = actor.system.get('sessionSync')
  assert.ok(catalog)
  assert.ok(sessions)
  assert.ok(sessionSync)
  assert.equal(actor.system.get('codex'), undefined)
  assert.equal(catalog.getSnapshot().status, 'active')
  assert.equal(sessions.getSnapshot().status, 'active')
  assert.equal(sessionSync.getSnapshot().status, 'active')
  assert.deepEqual(shutdowns, [])
  actor.send({ type: 'Shutdown' })
  assert.equal(actor.getSnapshot().status, 'done')
  assert.equal(catalog.getSnapshot().status, 'stopped')
  assert.equal(sessions.getSnapshot().status, 'stopped')
  assert.equal(sessionSync.getSnapshot().status, 'stopped')
  assert.deepEqual(shutdowns, ['codex'])
})

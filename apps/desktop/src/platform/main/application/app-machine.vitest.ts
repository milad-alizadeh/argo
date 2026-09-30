import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createActor } from 'xstate'
import { getShortestPaths } from 'xstate/graph'
import type { Database } from '@/database/database'
import { SessionListChanges } from '@/domains/sessions/main/api/session-list-changes'
import { TICKET_SYNC_TIMING } from '@/domains/tickets/main/sync/ticket-sync-supervisor-machine'
import type { HarnessRegistry } from '@/harnesses/registry'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { createAppMachine } from './app-machine'

const shutdowns: string[] = []
const registry = {
  claude: {},
  codex: { shutdown: () => shutdowns.push('codex') },
} as unknown as HarnessRegistry
const input = {
  // The Session sync supervisor reads each Harness's saved scan status at start.
  database: migratedDatabase(),
  sessionListChanges: new SessionListChanges(),
  ticketSync: {
    database: {} as Database,
    readPage: async () => ({ ok: false as const, failure: 'github-unreachable' as const }),
    readTicket: async () => ({ ok: false as const, failure: 'github-unreachable' as const }),
    changed: () => {},
    timing: TICKET_SYNC_TIMING,
  },
  ticketOperations: {
    database: {} as Database,
    write: async () => ({ ok: false as const, failure: 'github-unreachable' as const }),
    changed: () => {},
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

test('owns catalog, live and sync Session supervisors, the Ticket sync supervisor, and shared Harness clients until shutdown', () => {
  const actor = createActor(appMachine, { input }).start()
  const catalog = actor.system.get('catalog')
  const sessions = actor.system.get('sessions')
  const sessionSync = actor.system.get('sessionSync')
  const ticketSync = actor.system.get('ticketSync')
  assert.ok(ticketSync)
  assert.ok(catalog)
  assert.ok(sessions)
  assert.ok(sessionSync)
  assert.equal(actor.system.get('codex'), undefined)
  assert.equal(catalog.getSnapshot().status, 'active')
  assert.equal(sessions.getSnapshot().status, 'active')
  assert.equal(sessionSync.getSnapshot().status, 'active')
  assert.equal(ticketSync.getSnapshot().status, 'active')
  assert.deepEqual(shutdowns, [])
  actor.send({ type: 'Shutdown' })
  assert.equal(actor.getSnapshot().status, 'done')
  assert.equal(catalog.getSnapshot().status, 'stopped')
  assert.equal(sessions.getSnapshot().status, 'stopped')
  assert.equal(sessionSync.getSnapshot().status, 'stopped')
  assert.equal(ticketSync.getSnapshot().status, 'stopped')
  assert.deepEqual(shutdowns, ['codex'])
})

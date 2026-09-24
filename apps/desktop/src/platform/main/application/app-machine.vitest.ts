import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createActor } from 'xstate'
import { getShortestPaths } from 'xstate/graph'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import { appMachine } from './app-machine'

const input = { database: {} as DurableDatabase }

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

test('owns catalog, Session supervisor, and Codex children until shutdown', () => {
  const actor = createActor(appMachine, { input }).start()
  const catalog = actor.system.get('catalog')
  const sessions = actor.system.get('sessions')
  const codex = actor.system.get('codex')
  assert.ok(catalog)
  assert.ok(sessions)
  assert.ok(codex)
  assert.equal(catalog.getSnapshot().status, 'active')
  assert.equal(sessions.getSnapshot().status, 'active')
  assert.equal(codex.getSnapshot().status, 'active')
  actor.send({ type: 'Shutdown' })
  assert.equal(actor.getSnapshot().status, 'done')
  assert.equal(catalog.getSnapshot().status, 'stopped')
  assert.equal(sessions.getSnapshot().status, 'stopped')
  assert.equal(codex.getSnapshot().status, 'stopped')
})

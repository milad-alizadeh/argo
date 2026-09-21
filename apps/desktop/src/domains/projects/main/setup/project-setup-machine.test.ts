import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createProjectSetupActor,
  setupScreenOf,
} from '@/domains/projects/main/setup/project-setup-machine'

test('keeps manual setup and deferred setup as reactivatable resting paths', () => {
  const actor = createProjectSetupActor()
  actor.start()

  actor.send({ type: 'CHOOSE_MANUAL' })
  assert.equal(setupScreenOf(actor), 'manual')

  actor.send({ type: 'SAVE_MANUAL', source: '{"version":1}' })
  assert.equal(setupScreenOf(actor), 'ready')

  actor.send({ type: 'START_REPAIR_OR_UPGRADE' })
  actor.send({ type: 'DEFER' })
  assert.equal(setupScreenOf(actor), 'deferred')

  actor.send({ type: 'RESUME_SETUP' })
  assert.equal(setupScreenOf(actor), 'choosing-method')
})

test('restores the exact durable manual screen and source', () => {
  const first = createProjectSetupActor()
  first.start()
  first.send({ type: 'CHOOSE_MANUAL' })
  const restored = createProjectSetupActor(first.getPersistedSnapshot())
  restored.start()

  assert.equal(setupScreenOf(restored), 'manual')
  assert.equal(restored.getSnapshot().context.manualSource, '')
})

import { Database } from 'bun:sqlite'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { type TestContext, test } from 'node:test'
import { createProjectStore } from '@/domains/projects/main/sqlite-store'
import { createProjectSetupRegistry } from './project-setup-registry'

test('restores the exact ready manual setup after a restart', async (context) => {
  const { databasePath, store: first } = await temporarySetup(context)
  const source =
    '{"version":1,"targets":{"desktop":{"default":true,"path":"apps/desktop","setup":"bun install","run":"bun run dev","build":"bun run build","test":"bun test"}}}'
  const setup = createProjectSetupRegistry(first)
  setup.command({
    commandId: 'manual',
    event: { type: 'CHOOSE_MANUAL' },
    expectedRevision: 0,
    projectId: 'project-1',
  })
  setup.command({
    commandId: 'save',
    event: { type: 'SAVE_MANUAL', source },
    expectedRevision: 1,
    projectId: 'project-1',
  })
  first.close()
  const reopened = createProjectSetupRegistry(setupStore(databasePath))
  assert.deepEqual(reopened.snapshot('project-1'), {
    projectId: 'project-1',
    revision: 2,
    screen: 'ready',
    manualSource: source,
    attempt: null,
    questions: [],
    plan: null,
    acceptedPlan: null,
    progress: [],
    finalDiff: null,
    activeEffect: null,
    recoveryMessage: null,
    pendingApproval: null,
  })
})

test('maps an active durable effect to interrupted before a restored actor starts', async (context) => {
  const { databasePath, store: first } = await temporarySetup(context)
  const setup = createProjectSetupRegistry(first)
  setup.transition('project-1', { type: 'CHOOSE_AGENT', harness: 'claude' })
  setup.transition('project-1', { type: 'PREFLIGHT_PASSED' })
  setup.transition('project-1', { type: 'EFFECT_INTENT_SAVED', effect: 'planning' })
  first.close()

  const restored = createProjectSetupRegistry(setupStore(databasePath)).snapshot('project-1')
  assert.equal(restored.screen, 'interrupted')
  assert.equal(restored.activeEffect, null)
  assert.match(restored.recoveryMessage ?? '', /application restart/)
})

test('writes an effect intent before an external effect can begin', async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-project-setup-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const databasePath = path.join(directory, 'argo.sqlite')
  const database = new Database(databasePath)
  const store = createProjectStore(database)
  const setup = createProjectSetupRegistry(store)
  setup.transition('project-1', { type: 'CHOOSE_AGENT', harness: 'claude' })
  setup.transition('project-1', { type: 'PREFLIGHT_PASSED' })
  setup.transition('project-1', { type: 'EFFECT_INTENT_SAVED', effect: 'planning' })

  const effect = database
    .query('SELECT intent_json, result_json FROM project_setup_effect WHERE project_id = ?')
    .get('project-1') as { intent_json: string; result_json: string }
  assert.deepEqual(JSON.parse(effect.intent_json), {
    effect: 'planning',
    attemptNumber: 1,
    applicationSessionId: null,
    planningSessionId: null,
  })
  assert.deepEqual(JSON.parse(effect.result_json), { finalDiff: null, recoveryMessage: null })
  store.close()
})

test('persists immutable evidence for each restarted Attempt', async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-project-setup-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const databasePath = path.join(directory, 'argo.sqlite')
  const store = setupStore(databasePath)
  const setup = createProjectSetupRegistry(store)
  setup.transition('project-1', { type: 'CHOOSE_AGENT', harness: 'claude' })
  setup.transition('project-1', { type: 'PREFLIGHT_PASSED' })
  setup.transition('project-1', { type: 'PLANNING_SESSION_STARTED', sessionId: 'planning-1' })
  setup.transition('project-1', { type: 'EFFECT_INTERRUPTED', reason: 'stopped' })
  setup.transition('project-1', { type: 'RESTART_ATTEMPT' })
  setup.transition('project-1', { type: 'CHOOSE_AGENT', harness: 'claude' })
  const persisted = store.readProjectSetup('project-1')?.persistedSnapshot as {
    context: { attemptEvidence: Array<{ number: number; planningSessionId: string | null }> }
  }
  assert.deepEqual(persisted.context.attemptEvidence, [
    {
      number: 1,
      planningHarness: 'claude',
      planningSessionId: 'planning-1',
      applicationSessionId: null,
      acceptedPlanRevision: null,
    },
    {
      number: 2,
      planningHarness: 'claude',
      planningSessionId: null,
      applicationSessionId: null,
      acceptedPlanRevision: null,
    },
  ])
  store.close()
})

test('preserves a corrupt checkpoint as recovery evidence and starts a safe replacement actor', async (context) => {
  const { database, store } = await temporarySetup(context)
  const setup = createProjectSetupRegistry(store)
  setup.transition('project-1', { type: 'CHOOSE_MANUAL' })
  database
    .prepare('UPDATE project_setup_actor SET persisted_snapshot = ? WHERE project_id = ?')
    .run('{not-json', 'project-1')
  const reopened = createProjectSetupRegistry(store)
  assert.equal(reopened.snapshot('project-1').screen, 'choosing-method')
  const recovery = database
    .query('SELECT raw_record, reason FROM project_setup_recovery WHERE project_id = ?')
    .get('project-1') as { raw_record: string; reason: string }
  assert.match(recovery.raw_record, /not-json/)
  assert.match(recovery.reason, /JSON/)
  store.close()
})

function setupStore(databasePath: string) {
  const database = new Database(databasePath)
  return createProjectStore(database)
}

async function temporarySetup(context: TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-project-setup-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const databasePath = path.join(directory, 'argo.sqlite')
  const database = new Database(databasePath)
  return { database, databasePath, store: createProjectStore(database) }
}

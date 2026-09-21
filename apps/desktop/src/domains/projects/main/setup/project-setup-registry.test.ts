import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acceptedPlanFixture, planFixture } from '@/domains/projects/contract/setup-plan.fixture'
import {
  createProjectSetupRegistry,
  type ProjectSetupRecord,
  type ProjectSetupSnapshot,
} from '@/domains/projects/main/setup/project-setup-registry'

function memoryStore() {
  let saved: ProjectSetupRecord | null = null
  return {
    readProjectSetup: () => saved,
    writeProjectSetup: (record: ProjectSetupRecord) => {
      saved = record
    },
  }
}

const emptyDetails = {
  attempt: null,
  questions: [],
  plan: null,
  acceptedPlan: null,
  progress: [],
  finalDiff: null,
  activeEffect: null,
  recoveryMessage: null,
  pendingApproval: null,
}

test('returns one revisioned actor snapshot to stale and repeated commands', () => {
  const registry = createProjectSetupRegistry(memoryStore())

  const manual = registry.command({
    commandId: 'choose-manual',
    event: { type: 'CHOOSE_MANUAL' },
    expectedRevision: 0,
    projectId: 'project-1',
  })
  assert.deepEqual(manual, {
    projectId: 'project-1',
    revision: 1,
    screen: 'manual',
    manualSource: '',
    ...emptyDetails,
  })

  const stale = registry.command({
    commandId: 'defer-stale',
    event: { type: 'DEFER' },
    expectedRevision: 0,
    projectId: 'project-1',
  })
  assert.deepEqual(stale, manual)

  const repeated = registry.command({
    commandId: 'choose-manual',
    event: { type: 'DEFER' },
    expectedRevision: 1,
    projectId: 'project-1',
  })
  assert.deepEqual(repeated, manual)
})

test('restores a deferred ProjectSetup from its durable actor snapshot', () => {
  const store = memoryStore()
  const first = createProjectSetupRegistry(store)
  first.command({
    commandId: 'finish-later',
    event: { type: 'DEFER' },
    expectedRevision: 0,
    projectId: 'project-1',
  })

  const reopened = createProjectSetupRegistry(store)
  assert.deepEqual(reopened.snapshot('project-1'), {
    projectId: 'project-1',
    revision: 1,
    screen: 'deferred',
    manualSource: '',
    ...emptyDetails,
  })
})

test('publishes one changed snapshot to every observer of the shared actor', () => {
  const registry = createProjectSetupRegistry(memoryStore())
  const first: ProjectSetupSnapshot[] = []
  const second: ProjectSetupSnapshot[] = []
  const unsubscribeFirst = registry.subscribe('project-1', (snapshot) => first.push(snapshot))
  registry.subscribe('project-1', (snapshot) => second.push(snapshot))
  registry.command({
    commandId: 'defer',
    event: { type: 'DEFER' },
    expectedRevision: 0,
    projectId: 'project-1',
  })
  unsubscribeFirst()
  assert.deepEqual(
    first.map((snapshot) => snapshot.revision),
    [0, 1],
  )
  assert.deepEqual(
    second.map((snapshot) => snapshot.revision),
    [0, 1],
  )
})

test('stores empty manual targets for later completion', () => {
  const registry = createProjectSetupRegistry(memoryStore())
  registry.command({
    commandId: 'manual',
    event: { type: 'CHOOSE_MANUAL' },
    expectedRevision: 0,
    projectId: 'project-1',
  })
  assert.deepEqual(
    registry.command({
      commandId: 'save',
      event: { type: 'SAVE_MANUAL', source: '{"version":1,"targets":{}}' },
      expectedRevision: 1,
      projectId: 'project-1',
    }),
    {
      projectId: 'project-1',
      revision: 2,
      screen: 'ready',
      manualSource: '{"version":1,"targets":{}}',
      ...emptyDetails,
    },
  )
})

test('refuses an accepted plan that drifted from the reviewed plan', () => {
  const registry = createProjectSetupRegistry(memoryStore())
  const plan = planFixture()
  registry.transition('project-1', { type: 'CHOOSE_AGENT', harness: 'claude' })
  registry.transition('project-1', { type: 'PREFLIGHT_PASSED' })
  registry.transition('project-1', { type: 'PLAN_VALIDATED', plan })
  const before = registry.snapshot('project-1')
  const result = registry.commandWithStatus({
    commandId: 'accept-drifted-plan',
    event: {
      type: 'ACCEPT_PLAN',
      acceptedPlan: { ...acceptedPlanFixture(plan), sourceRevision: 'stale-plan' },
    },
    expectedRevision: before.revision,
    projectId: 'project-1',
  })
  assert.equal(result.accepted, false)
  assert.deepEqual(result.snapshot, before)
})

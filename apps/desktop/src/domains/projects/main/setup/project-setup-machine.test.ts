import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createActor } from 'xstate'
import { getAdjacencyMap, getShortestPaths } from 'xstate/graph'
import { assertModeledTransitions } from '@/platform/main/test-doubles/xstate-model-transitions'
import { projectSetupModelEvents } from '../../../../../test-fixtures/projects/setup/project-setup-model.fixture'
import { projectSetupRestartActor } from './actors/project-setup-restart-actor'
import type { OnboardingAgentDriver } from './onboarding-agent/runtime/run-onboarding-agent'
import { projectSetupMachine } from './project-setup-machine'
import type { ProjectSetupEvent } from './project-setup-machine-types'

const modeledMachine = projectSetupMachine.provide({
  actions: {
    forwardApplicationPermission: () => undefined,
    forwardPlanningPermission: () => undefined,
  },
})

type ModeledSnapshot = ReturnType<typeof modeledMachine.getInitialSnapshot>

const rootEvents = new Set(modeledMachine.root.ownEvents)
const traversal = {
  events: (snapshot: ModeledSnapshot) => {
    const stateNode = modeledMachine.getStateNodeById(`${modeledMachine.id}.${snapshot.value}`)
    const acceptedEvents = new Set([...rootEvents, ...stateNode.ownEvents])
    return projectSetupModelEvents.filter(
      (event) =>
        acceptedEvents.has(event.type) &&
        !(event.type === 'Choose agent' && (snapshot.context.attemptNumber ?? 0) >= 2),
    )
  },
  limit: 5_000,
  serializeEvent: (event: ProjectSetupEvent) => event.type,
  serializeState: (snapshot: ModeledSnapshot) =>
    JSON.stringify({
      value: snapshot.value,
      pendingApproval: snapshot.context.pendingApproval?.effect ?? null,
    }),
}

const shortestPaths = getShortestPaths(modeledMachine, traversal)
const shortestPathByState = new Map(
  shortestPaths.map((path) => [traversal.serializeState(path.state), path]),
)
const adjacency = getAdjacencyMap(modeledMachine, traversal)
const transitionCases = Object.values(adjacency).flatMap(({ state, transitions }) => {
  const prefix = shortestPathByState.get(traversal.serializeState(state))
  assert.ok(prefix)
  return Object.values(transitions).map((transition) => ({
    description: `${String(state.value)} — ${transition.event.type} → ${String(transition.state.value)}`,
    steps: [...prefix.steps.filter((step) => step.event.type !== 'xstate.init'), transition],
  }))
})

test('the model reaches every declared state', () => {
  const reachedStates = new Set(shortestPaths.map(({ state }) => state.value))
  assert.deepEqual(reachedStates, new Set(Object.keys(projectSetupMachine.states)))
})

for (const transitionCase of transitionCases) {
  test(`model: ${transitionCase.description}`, () => {
    assertModeledTransitions(modeledMachine, transitionCase, (actual) => {
      if (actual.context.pendingApproval) {
        assert.ok(actual.matches('Planning') || actual.matches('Applying'))
        assert.equal(actual.context.pendingApproval.effect, actual.context.activeEffect)
      }
    })
  })
}

test('a restarted planning Session is retired before the next setup Attempt begins', () => {
  const actor = createActor(modeledMachine)
  actor.start()
  const planningPath = shortestPaths.find((path) => path.state.matches('Planning'))
  assert.ok(planningPath)
  for (const step of planningPath.steps) {
    if (step.event.type !== 'xstate.init') actor.send(step.event)
  }
  actor.send({ type: 'Planning session started', sessionId: 'prior-session' })
  actor.send({ type: 'Effect interrupted', reason: 'interrupted' })
  assert.equal(actor.getSnapshot().matches('Interrupted'), true)
  actor.send({ type: 'Restart attempt' })
  assert.equal(actor.getSnapshot().matches('Restarting attempt'), true)
  assert.deepEqual(actor.getSnapshot().context.planningSessionId, 'prior-session')
  actor.send({ type: 'Restart attempt completed' })
  assert.equal(actor.getSnapshot().matches('Choosing setup method'), true)
  assert.equal(actor.getSnapshot().context.planningSessionId, null)
  assert.equal(actor.getSnapshot().context.attemptEvidence[0]?.planningSessionId, 'prior-session')
})

test('restart interrupts, waits for, and archives every Session from the prior Attempt', async () => {
  const effects: string[] = []
  const driver: OnboardingAgentDriver = {
    start: () => 'unused',
    send: async () => undefined,
    liveMessages: () => [],
    interrupt: async (sessionId) => void effects.push(`interrupt:${sessionId}`),
    waitForStop: async (sessionId) => void effects.push(`stopped:${sessionId}`),
    pendingPermission: () => null,
    decidePermission: () => true,
  }
  const machine = projectSetupMachine.provide({
    actors: {
      restart: projectSetupRestartActor({
        driver,
        archiveSession: async (sessionId) => {
          effects.push(`archive:${sessionId}`)
          return true
        },
      }),
    },
  })
  const actor = createActor(machine)
  let enteredRestart = false
  const restarted = new Promise<void>((resolve) => {
    actor.subscribe((snapshot) => {
      if (snapshot.matches('Restarting attempt')) enteredRestart = true
      if (enteredRestart && snapshot.matches('Choosing setup method')) resolve()
    })
  })
  actor.start()
  actor.send({ type: 'Choose agent', harness: 'claude' })
  actor.send({ type: 'Planning session started', sessionId: 'planning-session' })
  actor.send({ type: 'Effect interrupted', reason: 'interrupted' })
  actor.send({ type: 'Restart attempt' })
  await restarted
  assert.deepEqual(effects, [
    'interrupt:planning-session',
    'stopped:planning-session',
    'archive:planning-session',
  ])
  actor.stop()
})

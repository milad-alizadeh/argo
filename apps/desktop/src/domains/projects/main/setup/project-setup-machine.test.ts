import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createActor } from 'xstate'
import { getAdjacencyMap, getShortestPaths } from 'xstate/graph'
import { assertModeledTransitions } from '@/platform/main/test-doubles/xstate-model-transitions'
import { projectSetupModelEvents } from '../../../../../test-fixtures/projects/setup/project-setup-model.fixture'
import {
  acceptedPlanFixture,
  planFixture,
} from '../../../../../test-fixtures/projects/setup/setup-plan.fixture'
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

function waitForRestartState(
  actor: ReturnType<typeof createActor>,
  destination: 'Choosing setup method' | 'Restart failed',
) {
  let enteredRestart = false
  return new Promise<void>((resolve) => {
    let subscription: ReturnType<typeof actor.subscribe>
    subscription = actor.subscribe((snapshot) => {
      if (snapshot.matches('Restarting attempt')) enteredRestart = true
      if (enteredRestart && snapshot.matches(destination)) {
        subscription.unsubscribe()
        resolve()
      }
    })
  })
}

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

for (const priorEffect of ['planning', 'application'] as const) {
  test(`restart retires every Session from the prior Attempt after ${priorEffect}`, async () => {
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
    actor.start()
    actor.send({ type: 'Choose agent', harness: 'claude' })
    actor.send({ type: 'Planning session started', sessionId: 'planning-session' })
    if (priorEffect === 'application') {
      const plan = planFixture()
      actor.send({ type: 'Plan validated', plan })
      actor.send({ type: 'Continue plan review' })
      actor.send({ type: 'Select application harness', harness: 'claude' })
      actor.send({ type: 'Accept plan', acceptedPlan: acceptedPlanFixture(plan) })
      actor.send({ type: 'Application session started', sessionId: 'application-session' })
    }
    actor.send({ type: 'Effect interrupted', reason: 'interrupted' })
    const restarted = waitForRestartState(actor, 'Choosing setup method')
    actor.send({ type: 'Restart attempt' })
    await restarted
    const priorSessionIds =
      priorEffect === 'planning'
        ? ['planning-session']
        : ['planning-session', 'application-session']
    assert.deepEqual(
      effects,
      priorSessionIds.flatMap((sessionId) => [
        `interrupt:${sessionId}`,
        `stopped:${sessionId}`,
        `archive:${sessionId}`,
      ]),
    )
    actor.stop()
  })
}

test('a failed restart remains recoverable and a retry retires the prior Session', async () => {
  let archiveAttempts = 0
  const driver: OnboardingAgentDriver = {
    start: () => 'unused',
    send: async () => undefined,
    liveMessages: () => [],
    interrupt: async () => undefined,
    waitForStop: async () => undefined,
    pendingPermission: () => null,
    decidePermission: () => true,
  }
  const machine = projectSetupMachine.provide({
    actors: {
      restart: projectSetupRestartActor({
        driver,
        archiveSession: async () => {
          archiveAttempts += 1
          return archiveAttempts > 1
        },
      }),
    },
  })
  const actor = createActor(machine)
  actor.start()
  actor.send({ type: 'Choose agent', harness: 'claude' })
  actor.send({ type: 'Planning session started', sessionId: 'prior-session' })
  actor.send({ type: 'Effect interrupted', reason: 'interrupted' })
  const failed = waitForRestartState(actor, 'Restart failed')
  actor.send({ type: 'Restart attempt' })
  await failed
  assert.equal(actor.getSnapshot().matches('Restart failed'), true)
  assert.equal(actor.getSnapshot().context.recoveryMessage, 'restart-failed')
  assert.equal(actor.getSnapshot().context.planningSessionId, 'prior-session')

  const recovered = waitForRestartState(actor, 'Choosing setup method')
  actor.send({ type: 'Restart attempt' })
  await recovered
  assert.equal(archiveAttempts, 2)
  assert.equal(actor.getSnapshot().context.planningSessionId, null)
  actor.stop()
})

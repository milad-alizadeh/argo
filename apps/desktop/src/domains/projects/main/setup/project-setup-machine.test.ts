import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getAdjacencyMap, getShortestPaths } from 'xstate/graph'
import { assertModeledTransitions } from '@/platform/main/testing/xstate-model-transitions'
import { projectSetupModelEvents } from '../../../../../test-fixtures/projects/setup/project-setup-model.fixture'
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

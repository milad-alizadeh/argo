import assert from 'node:assert/strict'
import { test } from 'node:test'
import { type ActorLogic, createActor } from 'xstate'
import { adjacencyMapToArray, getAdjacencyMap, getShortestPaths } from 'xstate/graph'
import { assertModeledTransitions } from '@/platform/main/test-doubles/xstate-model-transitions'
import {
  type HarnessSignInModelEvent,
  harnessSignInModelEvents,
} from '../../../../test-fixtures/harness-signin/harness-sign-in-model.fixture'
import { createHarnessSignInMachine, type HarnessSignInDriver } from './harness-sign-in-machine'

// The model drives every transition, including 'Signing in' -> 'Checking readiness' -> Ready/
// Failed, by sending the event XState itself would send when the invoked promise settles, never
// by letting the promise actually resolve: a driver that settled on its own would race the steps
// the model sends by hand. So the driver here never settles.
const inertDriver: HarnessSignInDriver = {
  login: () => new Promise(() => undefined),
  checkReadiness: () => new Promise(() => undefined),
}

const machine = createHarnessSignInMachine(inertDriver)
type ModeledSnapshot = ReturnType<typeof machine.getInitialSnapshot>
// The graph and the actor both need to accept events outside the machine's own declared event
// type (only 'Cancel'): this is the one seam where the model steps outside that type.
const modeledLogic = machine as unknown as ActorLogic<ModeledSnapshot, HarnessSignInModelEvent>

const rootEvents = new Set<string>(machine.root.ownEvents)
const traversal = {
  events: (snapshot: ModeledSnapshot) => {
    const stateNode = machine.getStateNodeById(`${machine.id}.${String(snapshot.value)}`)
    const acceptedEvents = new Set<string>([...rootEvents, ...stateNode.ownEvents])
    return harnessSignInModelEvents.filter((event) => acceptedEvents.has(event.type))
  },
  limit: 100,
  serializeEvent: (event: HarnessSignInModelEvent) =>
    'output' in event ? `${event.type}:${JSON.stringify(event.output)}` : event.type,
  serializeState: (snapshot: ModeledSnapshot) => String(snapshot.value),
}

const shortestPaths = getShortestPaths<typeof modeledLogic>(modeledLogic, traversal)
const shortestPathByState = new Map(
  shortestPaths.map((path) => [traversal.serializeState(path.state), path]),
)
const adjacency = getAdjacencyMap(modeledLogic, traversal)
const transitionCases = adjacencyMapToArray(adjacency).map(({ state, event, nextState }) => {
  const prefix = shortestPathByState.get(traversal.serializeState(state))
  assert.ok(prefix)
  return {
    description: `${String(state.value)} — ${traversal.serializeEvent(event)} → ${String(nextState.value)}`,
    steps: [
      ...prefix.steps.filter((step) => step.event.type !== 'xstate.init'),
      { event, state: nextState },
    ],
  }
})

test('the model reaches every declared state', () => {
  const reachedStates = new Set(shortestPaths.map(({ state }) => state.value))
  assert.deepEqual(reachedStates, new Set(Object.keys(machine.states)))
})

for (const transitionCase of transitionCases) {
  test(`model: ${transitionCase.description}`, () => {
    assertModeledTransitions(modeledLogic, transitionCase, (actual) => {
      // Observable outcomes at settlement: Ready always carries the ready readiness it awaited,
      // Failed never claims a ready one (whether it came from a failed/canceled login or a
      // non-ready readiness check), and Canceled carries none at all.
      if (actual.matches('Ready')) {
        assert.ok(actual.hasTag('settled'))
        assert.equal(actual.context.readiness?.state, 'ready')
      }
      if (actual.matches('Failed')) {
        assert.ok(actual.hasTag('settled'))
        assert.notEqual(actual.context.readiness?.state, 'ready')
      }
      if (actual.matches('Canceled')) {
        assert.ok(actual.hasTag('settled'))
        assert.equal(actual.context.readiness, null)
      }
    })
  })
}

// Path generation drives 'Signing in' -> Canceled by sending 'Cancel' as a bare event: it cannot
// see that the same transition also aborts the invoked `login`, since that is a side effect of
// stopping the invoked actor, not a step the traversal can assert on.
test('Cancel aborts the in-flight login', () => {
  let aborted = false
  const driver: HarnessSignInDriver = {
    login: (signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          aborted = true
          reject(new Error('aborted'))
        })
      }),
    checkReadiness: () => new Promise(() => undefined),
  }
  const actor = createActor(createHarnessSignInMachine(driver)).start()
  actor.send({ type: 'Cancel' })
  assert.equal(actor.getSnapshot().value, 'Canceled')
  assert.equal(aborted, true)
  actor.stop()
})

// Path generation models a login failure by injecting the 'output: failed' completion event
// directly. It cannot express a login promise that actually rejects, which is the branch
// `driver.login(signal).catch(...)` in the machine exists to cover.
test('a login that rejects settles Failed rather than throwing', async () => {
  const driver: HarnessSignInDriver = {
    login: async () => {
      throw new Error('spawn failed')
    },
    checkReadiness: () => new Promise(() => undefined),
  }
  const actor = createActor(createHarnessSignInMachine(driver)).start()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(actor.getSnapshot().value, 'Failed')
  actor.stop()
})

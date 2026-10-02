import { expect, test } from 'bun:test'
import { createActor, type EventFromLogic } from 'xstate'
import { adjacencyMapToArray, getAdjacencyMap, getShortestPaths } from 'xstate/graph'
import { assertModeledTransitions } from '@/platform/main/test-doubles/xstate-model-transitions'
import { feedStallMachine } from './feed-stall-machine'

const model = feedStallMachine
type FeedStallEvent = EventFromLogic<typeof model>
const firstAttempt: FeedStallEvent = { type: 'Awaiting', identity: 'session-one:retry-zero' }
const retry: FeedStallEvent = { type: 'Awaiting', identity: 'session-one:retry-one' }
const otherSession: FeedStallEvent = { type: 'Awaiting', identity: 'session-two:retry-zero' }
const settled: FeedStallEvent = { type: 'Settled' }
const events: FeedStallEvent[] = [firstAttempt, retry, otherSession, settled, { type: 'Timed out' }]
type Snapshot = ReturnType<typeof model.getInitialSnapshot>
const traversal = {
  events: (snapshot: Snapshot) => {
    const node = model.getStateNodeById(`${model.id}.${snapshot.value}`)
    return events.filter((event) => node.ownEvents.includes(event.type))
  },
  serializeEvent: (event: FeedStallEvent) =>
    event.type === 'Awaiting' ? `${event.type}:${event.identity}` : event.type,
  serializeState: (snapshot: Snapshot) =>
    JSON.stringify({ value: snapshot.value, identity: snapshot.context.identity }),
}
const shortestPaths = getShortestPaths(model, traversal)
const shortestPathByState = new Map(
  shortestPaths.map((path) => [traversal.serializeState(path.state), path]),
)
const paths = adjacencyMapToArray(getAdjacencyMap(model, traversal)).map(
  ({ state, event, nextState }) => {
    const prefix = shortestPathByState.get(traversal.serializeState(state))
    if (!prefix) throw new Error(`No shortest path reaches ${String(state.value)}.`)
    return {
      name: `${String(state.value)} — ${traversal.serializeEvent(event)}`,
      // The first step is the `xstate.init` event, which the actor sends itself.
      steps: [...prefix.steps.slice(1), { event, state: nextState }],
    }
  },
)

test('the model reaches every Feed stall state', () => {
  expect(new Set<string>(shortestPaths.map(({ state }) => state.value))).toEqual(
    new Set(Object.keys(model.states)),
  )
})

for (const path of paths) {
  test(`Feed stall path: ${path.name}`, () => {
    assertModeledTransitions(model, path, (actual) => {
      if (actual.matches('waiting')) expect(actual.context.stalled).toBe(false)
      if (actual.matches('stalled')) expect(actual.context.stalled).toBe(true)
      if (actual.matches('ready')) expect(actual.context.identity).toBe(null)
    })
  })
}

test('a retry or Session switch clears a stalled Feed before its new timer expires', () => {
  const actor = createActor(model)
  actor.start()
  for (const event of [firstAttempt, settled, retry]) actor.send(event)
  let actual = actor.getSnapshot()
  expect(actual.matches('waiting')).toBe(true)
  expect(actual.context.stalled).toBe(false)
  expect(actual.context.identity).toBe('session-one:retry-one')
  actor.send(settled)
  actor.send(otherSession)
  actual = actor.getSnapshot()
  expect(actual.matches('waiting')).toBe(true)
  expect(actual.context.stalled).toBe(false)
  expect(actual.context.identity).toBe('session-two:retry-zero')
})

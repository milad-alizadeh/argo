import { expect, test } from 'bun:test'
import { createActor } from 'xstate'
import { getAdjacencyMap, getShortestPaths } from 'xstate/graph'
import { assertModeledTransitions } from '@/platform/main/test-doubles/xstate-model-transitions'
import { feedStallMachine } from './feed-stall-machine'

const model = feedStallMachine
const events = [
  { type: 'Awaiting' as const, identity: 'session-one:retry-zero' },
  { type: 'Awaiting' as const, identity: 'session-one:retry-one' },
  { type: 'Awaiting' as const, identity: 'session-two:retry-zero' },
  { type: 'Settled' as const },
  { type: 'Timed out' as const },
]
type Snapshot = ReturnType<typeof model.getInitialSnapshot>
const traversal = {
  events: (snapshot: Snapshot) => {
    const node = model.getStateNodeById(`${model.id}.${snapshot.value}`)
    return events.filter((event) => node.ownEvents.includes(event.type))
  },
  serializeEvent: (event: (typeof events)[number]) =>
    event.type === 'Awaiting' ? `${event.type}:${event.identity}` : event.type,
  serializeState: (snapshot: Snapshot) =>
    JSON.stringify({ value: snapshot.value, identity: snapshot.context.identity }),
}
const shortestPaths = getShortestPaths(model, traversal)
const shortestPathByState = new Map(
  shortestPaths.map((path) => [traversal.serializeState(path.state), path]),
)
const paths = Object.values(getAdjacencyMap(model, traversal)).flatMap(({ state, transitions }) => {
  const prefix = shortestPathByState.get(traversal.serializeState(state))
  if (!prefix) throw new Error(`No shortest path reaches ${String(state.value)}.`)
  return Object.values(transitions).map((transition) => ({
    name: `${String(state.value)} — ${traversal.serializeEvent(transition.event)}`,
    steps: [...prefix.steps.filter((step) => step.event.type !== 'xstate.init'), transition],
  }))
})

test('the model reaches every Feed stall state', () => {
  expect(new Set(shortestPaths.map(({ state }) => state.value))).toEqual(
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
  for (const event of [events[0], events[3], events[1]]) actor.send(event)
  let actual = actor.getSnapshot()
  expect(actual.matches('waiting')).toBe(true)
  expect(actual.context.stalled).toBe(false)
  expect(actual.context.identity).toBe('session-one:retry-one')
  actor.send(events[3])
  actor.send(events[2])
  actual = actor.getSnapshot()
  expect(actual.matches('waiting')).toBe(true)
  expect(actual.context.stalled).toBe(false)
  expect(actual.context.identity).toBe('session-two:retry-zero')
})

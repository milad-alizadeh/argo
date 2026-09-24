import { expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import type { ActorLogic } from 'xstate'
import { createActor, waitFor } from 'xstate'
import { adjacencyMapToArray, getAdjacencyMap, getShortestPaths } from 'xstate/graph'
import { claudeHarnessInfo } from '@/harnesses/claude/catalog'
import { codexHarnessInfo } from '@/harnesses/codex/catalog'
import { assertModeledTransitions } from '@/platform/main/test-doubles/xstate-model-transitions'
import { claudeModelCatalogFixture } from '../../../test-fixtures/sessions/claude-model-catalog.fixture'
import { codexModelCatalogFixture } from '../../../test-fixtures/sessions/codex-model-catalog.fixture'
import {
  catalogSnapshot,
  createHarnessCatalogMachine,
  unavailable,
} from './harness-catalog-machine'

test('publishes a serializable catalog with Model-specific Efforts and defaults', () => {
  const snapshot = catalogSnapshot([
    claudeHarnessInfo(claudeModelCatalogFixture()),
    codexHarnessInfo(codexModelCatalogFixture()),
  ])
  const parsed = JSON.parse(JSON.stringify(snapshot))
  expect(parsed.harnesses[0]).toMatchObject({
    harness: 'claude',
    availability: 'available',
    defaultModelId: 'sonnet-live',
    models: [{ value: 'sonnet-live', efforts: ['low', 'high'] }],
  })
  expect(parsed.harnesses[1]).toMatchObject({
    harness: 'codex',
    availability: 'available',
    defaultModelId: 'gpt-live',
    models: [{ value: 'gpt-live', defaultEffort: 'focused', efforts: ['focused'] }],
  })
})

test('keeps an available Harness visible when the other catalog is unavailable', () => {
  const catalog = catalogSnapshot([
    claudeHarnessInfo(claudeModelCatalogFixture()),
    codexHarnessInfo(null),
  ])
  expect(catalog.harnesses[0]?.availability).toBe('available')
  expect(catalog.harnesses[1]).toEqual(unavailable('codex'))
})

test('loads on request and retries a failed catalog load', async () => {
  let attempts = 0
  const machine = createHarnessCatalogMachine(async () => {
    attempts += 1
    if (attempts === 1) throw new Error('temporary catalog failure')
    return catalogSnapshot([claudeHarnessInfo(claudeModelCatalogFixture()), codexHarnessInfo(null)])
  })
  const actor = createActor(machine).start()
  actor.send({ type: 'Catalog requested' })
  const failed = await waitFor(actor, (snapshot) => snapshot.matches('Failed'))
  expect(failed.context.failure).toContain('temporary catalog failure')
  actor.send({ type: 'Retry' })
  const ready = await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
  expect(ready.context.catalog.harnesses[0]?.availability).toBe('available')
  expect(attempts).toBe(2)
  actor.stop()
})

const catalog = catalogSnapshot([claudeHarnessInfo(null), codexHarnessInfo(null)])
const modeledEvents = [
  { type: 'Catalog requested' as const },
  { type: 'Refresh' as const },
  { type: 'Retry' as const },
  { type: 'xstate.done.actor.0.harnessCatalog.Loading' as const, output: catalog },
  { type: 'xstate.error.actor.0.harnessCatalog.Loading' as const, error: 'modeled failure' },
  { type: 'xstate.init' as const },
]
const modeledMachine = createHarnessCatalogMachine(() => new Promise(() => undefined))
type ModeledSnapshot = ReturnType<typeof modeledMachine.getInitialSnapshot>
const modeledLogic = modeledMachine as unknown as ActorLogic<
  ModeledSnapshot,
  (typeof modeledEvents)[number]
>
const traversal = {
  events: (snapshot: ModeledSnapshot) => {
    const node = modeledMachine.getStateNodeById(`${modeledMachine.id}.${snapshot.value}`)
    const acceptedEvents = new Set<string>(node.ownEvents)
    if (snapshot.matches('Loading')) {
      acceptedEvents.add('xstate.done.actor.0.harnessCatalog.Loading')
      acceptedEvents.add('xstate.error.actor.0.harnessCatalog.Loading')
    }
    return modeledEvents.filter(({ type }) => acceptedEvents.has(type))
  },
  serializeEvent: (event: (typeof modeledEvents)[number]) => event.type,
  serializeState: (snapshot: ModeledSnapshot) => String(snapshot.value),
}
const shortestPaths = getShortestPaths(modeledLogic, traversal)
const shortestPathByState = new Map(
  shortestPaths.map((path) => [traversal.serializeState(path.state), path]),
)
const adjacency = getAdjacencyMap<ModeledSnapshot, (typeof modeledEvents)[number], undefined>(
  modeledLogic,
  traversal,
)
const modeledTransitions = adjacencyMapToArray(adjacency).map(({ state, event, nextState }) => {
  const prefix = shortestPathByState.get(traversal.serializeState(state))
  assert.ok(prefix)
  return {
    description: `${String(state.value)} — ${traversal.serializeEvent(event)}`,
    steps: [
      ...prefix.steps.filter((step) => step.event.type !== 'xstate.init'),
      { event, state: nextState },
    ],
  }
})

test('models Idle, Loading, Ready and Failed states', () => {
  assert.deepEqual(
    new Set(shortestPaths.map(({ state }) => state.value)),
    new Set(Object.keys(modeledMachine.states)),
  )
})

for (const transition of modeledTransitions) {
  test(`catalog path: ${transition.description}`, () => {
    assertModeledTransitions(modeledLogic, transition, (actual) => {
      if (actual.matches('Ready')) expect(actual.context.catalog).toEqual(catalog)
      if (actual.matches('Failed')) expect(actual.context.failure).toContain('modeled failure')
    })
  })
}

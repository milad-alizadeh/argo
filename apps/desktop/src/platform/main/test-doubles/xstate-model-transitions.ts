// Every model-based machine test (AGENTS.md: "Model XState paths") walks a `getAdjacencyMap`
// transition case the same way: replay its steps on a fresh actor, and after each one check the
// snapshot lands where the model says and that its context survived a JSON round-trip (proof it
// holds no function, class instance or other value XState could not itself serialize).
import assert from 'node:assert/strict'
import { type ActorLogic, createActor, type EventObject, type Snapshot } from 'xstate'

type MachineLikeSnapshot = Snapshot<unknown> & { context: unknown; value: unknown }

type TransitionStep<TEvent, TSnapshot> = { event: TEvent; state: TSnapshot }
export type TransitionCase<TEvent, TSnapshot> = { steps: TransitionStep<TEvent, TSnapshot>[] }

export function assertModeledTransitions<
  TSnapshot extends MachineLikeSnapshot,
  TEvent extends EventObject,
>(
  logic: ActorLogic<TSnapshot, TEvent>,
  transitionCase: TransitionCase<TEvent, TSnapshot>,
  // Per-step assertions specific to one machine's context shape (e.g. a settled tag's invariants).
  assertStep?: (snapshot: TSnapshot) => void,
) {
  const actor = createActor(logic)
  actor.start()
  for (const step of transitionCase.steps) {
    actor.send(step.event)
    const actual = actor.getSnapshot()
    assert.equal(actual.value, step.state.value)
    assert.deepEqual(JSON.parse(JSON.stringify(actual.context)), actual.context)
    assertStep?.(actual)
  }
}

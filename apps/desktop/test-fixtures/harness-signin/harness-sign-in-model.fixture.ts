// Model events for harness-sign-in-machine.test.ts. 'Cancel' is the one event the machine
// declares; the other two are the 'xstate.done.actor.<id>' events XState itself raises when the
// invoked `login` and `checkReadiness` promises settle (#2579 follow-up). The traversal drives
// both kinds the same way, by event type, the way `project-setup-model.fixture.ts` drives the
// events its own invoked actors send back.
import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'
import type { HarnessSignInOutcome } from '@/domains/harness-signin/main/harness-sign-in-machine'

export type HarnessSignInModelEvent =
  | { type: 'Cancel' }
  | { type: 'xstate.done.actor.login'; output: HarnessSignInOutcome }
  | { type: 'xstate.done.actor.checkReadiness'; output: HarnessReadiness }
  // XState's own bootstrap event, never sent by the model: the type exists so a path's leading
  // step (always this one) can be filtered out and compared against without a widening cast.
  | { type: 'xstate.init' }

const readyReadiness: HarnessReadiness = { harness: 'claude', state: 'ready', detail: null }
const blockedReadiness: HarnessReadiness = {
  harness: 'claude',
  state: 'policy-blocked',
  detail: 'org policy',
}

export const harnessSignInModelEvents: HarnessSignInModelEvent[] = [
  { type: 'Cancel' },
  { type: 'xstate.done.actor.login', output: 'completed' },
  { type: 'xstate.done.actor.login', output: 'canceled' },
  { type: 'xstate.done.actor.login', output: 'failed' },
  { type: 'xstate.done.actor.checkReadiness', output: readyReadiness },
  { type: 'xstate.done.actor.checkReadiness', output: blockedReadiness },
]

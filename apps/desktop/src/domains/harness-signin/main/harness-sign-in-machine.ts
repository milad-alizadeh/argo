// One Harness sign-in attempt (#2579), as an XState machine: Argo owns this transition set
// (Signing in -> Checking readiness -> Ready/Failed, or Cancel at any point during Signing in),
// which is exactly the case AGENTS.md reserves XState for. A fresh actor is created per attempt;
// `harness-sign-in.ts` holds the per-Harness map, the resume-vs-restart choice and the
// injected-clock expiry, none of which is this attempt's own transition.
import { assign, fromPromise, setup } from 'xstate'
import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'

export type HarnessSignInOutcome = 'completed' | 'canceled' | 'failed'

export type HarnessSignInDriver = {
  // Runs the vendor CLI's own sign-in flow to completion; resolves 'canceled' once `signal` fires.
  login(signal: AbortSignal): Promise<HarnessSignInOutcome>
  checkReadiness(): Promise<HarnessReadiness>
}

type HarnessSignInMachineContext = {
  readiness: HarnessReadiness | null
}

type HarnessSignInMachineEvent = {
  type: 'Cancel'
}

// One machine per attempt, closed over that attempt's driver: the driver is not context data, it
// is the dependency this attempt runs against, on the same footing as `project-setup-machine`'s
// injected actors.
export function createHarnessSignInMachine(driver: HarnessSignInDriver) {
  return setup({
    types: {} as {
      context: HarnessSignInMachineContext
      events: HarnessSignInMachineEvent
      tags: 'pending' | 'settled'
    },
    actors: {
      // fromPromise's own `signal` fires when this invocation is stopped (state exit, or the
      // actor itself is stopped), so a Cancel transition or an external `.stop()` reaches the
      // driver's AbortSignal without a hand-kept AbortController.
      login: fromPromise<HarnessSignInOutcome, void>(({ signal }) =>
        driver.login(signal).catch((): HarnessSignInOutcome => 'failed'),
      ),
      checkReadiness: fromPromise<HarnessReadiness, void>(() => driver.checkReadiness()),
    },
  }).createMachine({
    id: 'harness-sign-in',
    context: {
      readiness: null,
    },
    initial: 'Signing in',
    states: {
      'Signing in': {
        tags: 'pending',
        invoke: {
          id: 'login',
          src: 'login',
          onDone: [
            {
              guard: ({ event }) => event.output === 'completed',
              target: 'Checking readiness',
            },
            {
              guard: ({ event }) => event.output === 'canceled',
              target: 'Canceled',
            },
            {
              target: 'Failed',
            },
          ],
        },
        on: {
          Cancel: 'Canceled',
        },
      },
      'Checking readiness': {
        tags: 'pending',
        invoke: {
          id: 'checkReadiness',
          src: 'checkReadiness',
          onDone: [
            {
              guard: ({ event }) => event.output.state === 'ready',
              target: 'Ready',
              actions: assign({
                readiness: ({ event }) => event.output,
              }),
            },
            {
              target: 'Failed',
              actions: assign({
                readiness: ({ event }) => event.output,
              }),
            },
          ],
        },
      },
      Ready: {
        type: 'final',
        tags: 'settled',
      },
      Canceled: {
        type: 'final',
        tags: 'settled',
      },
      Failed: {
        type: 'final',
        tags: 'settled',
      },
    },
  })
}

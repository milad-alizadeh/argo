// One sign-in attempt per Harness, held in the main process across start/wait/cancel calls
// (mirrors domains/accounts/main/sign-in.ts's single-Pending shape). Unlike that one-at-a-time
// Account sign-in, a live attempt here is resumed rather than replaced: a lost OAuth browser tab
// or an interrupted CLI process does not cost the person their place until the attempt expires.
//
// The attempt's own idle-to-settled transition is `harness-sign-in-machine.ts`, an XState
// machine (#2579 follow-up): Argo owns that transition set. Expiry is not part of that machine —
// it is checked here, against the injected clock, exactly where the original closure checked it,
// so a test-fed `now()` still controls it without a real timer.
import { type ActorRefFrom, createActor, waitFor } from 'xstate'
import type {
  Harness,
  HarnessReadiness,
  HarnessSignInSnapshot,
  HarnessSignInStatus,
} from '@/domains/harness-signin/contract/contract'
import {
  createHarnessSignInMachine,
  type HarnessSignInDriver,
  type HarnessSignInOutcome,
} from './harness-sign-in-machine'

export type { HarnessSignInDriver, HarnessSignInOutcome }

export type HarnessSignInWaitResult = {
  snapshot: HarnessSignInSnapshot
  readiness: HarnessReadiness | null
}

type Attempt = {
  actor: ActorRefFrom<ReturnType<typeof createHarnessSignInMachine>>
  expiresAt: number
}

const DEFAULT_EXPIRES_AFTER_MS = 10 * 60 * 1000

export function createHarnessSignIn(
  drivers: Record<Harness, HarnessSignInDriver>,
  options: { expiresAfterMs?: number; now?: () => number } = {},
) {
  const expiresAfterMs = options.expiresAfterMs ?? DEFAULT_EXPIRES_AFTER_MS
  const now = options.now ?? Date.now
  const attempts = new Map<Harness, Attempt>()

  function live(harness: Harness): Attempt | null {
    const attempt = attempts.get(harness)
    if (!attempt) return null
    if (now() >= attempt.expiresAt) {
      attempt.actor.stop()
      attempts.delete(harness)
      return null
    }
    return attempt
  }

  function snapshot(
    harness: Harness,
    status: HarnessSignInStatus,
    expiresAt: number | null,
  ): HarnessSignInSnapshot {
    return { harness, status, expiresAt }
  }

  return {
    // A live attempt is resumed, never replaced: the same wait keeps its place in the flow.
    start(harness: Harness): HarnessSignInSnapshot {
      const current = live(harness)
      if (current) return snapshot(harness, 'pending', current.expiresAt)
      const actor = createActor(createHarnessSignInMachine(drivers[harness])).start()
      const expiresAt = now() + expiresAfterMs
      attempts.set(harness, { actor, expiresAt })
      return snapshot(harness, 'pending', expiresAt)
    },

    // Null means no attempt was ever started for this Harness: the caller's job to report as such.
    async wait(harness: Harness): Promise<HarnessSignInWaitResult | null> {
      const attempt = attempts.get(harness)
      if (!attempt) return null
      if (now() >= attempt.expiresAt) {
        attempt.actor.stop()
        attempts.delete(harness)
        return { snapshot: snapshot(harness, 'expired', null), readiness: null }
      }
      // `waitFor` only subscribes: several concurrent `wait` callers share this one actor and its
      // one invoked login, rather than each spawning its own.
      const settled = await waitFor(attempt.actor, (state) => state.status === 'done')
      if (attempts.get(harness) === attempt) attempts.delete(harness)
      if (settled.matches('Canceled'))
        return { snapshot: snapshot(harness, 'canceled', null), readiness: null }
      const status: HarnessSignInStatus = settled.matches('Ready') ? 'ready' : 'failed'
      return { snapshot: snapshot(harness, status, null), readiness: settled.context.readiness }
    },

    async cancel(harness: Harness): Promise<HarnessSignInSnapshot> {
      const attempt = attempts.get(harness)
      attempts.delete(harness)
      attempt?.actor.send({ type: 'Cancel' })
      attempt?.actor.stop()
      return snapshot(harness, 'canceled', null)
    },

    dispose() {
      for (const attempt of attempts.values()) attempt.actor.stop()
      attempts.clear()
    },
  }
}

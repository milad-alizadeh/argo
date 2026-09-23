import { useEffect, useState, useSyncExternalStore } from 'react'
import { createActor } from 'xstate'
import { feedStallMachine } from './feed-stall-machine'

// How long a Session may sit with no progress — no Feed yet, or a Feed that has not settled —
// before the reader sees a stalled state instead of an indefinite spinner (#2102). Every caller
// passes a shortened value in a story or test rather than waiting on this real bound.
export const FEED_STALL_TIMEOUT_MS = 8000

// Shared by the two places a Feed can sit waiting with nothing to show: BasicFeed's standing
// state and a running Session whose first Feed has not arrived.
// `awaiting` names the attempt: a plain boolean cannot restart the bound on a retry or a Session
// switch, since it reads the same both before and after selecting a different Session that is
// also still awaiting (cancel-on-navigate, #2102) — so a caller with nothing to show passes an
// identity for what it is waiting on instead of `true`.
export function useStallTimer(awaiting: string | false, timeoutMs: number) {
  const [actor] = useState(() => createActor(feedStallMachine))
  const stalled = useSyncExternalStore(
    (onChange) => {
      const subscription = actor.subscribe(onChange)
      return () => subscription.unsubscribe()
    },
    () => actor.getSnapshot().context.stalled,
    () => actor.getSnapshot().context.stalled,
  )

  useEffect(() => {
    actor.start()
  }, [actor])

  useEffect(() => {
    if (awaiting === false) {
      actor.send({ type: 'Settled' })
      return
    }
    actor.send({ type: 'Awaiting', identity: awaiting })
    const timer = window.setTimeout(() => actor.send({ type: 'Timed out' }), timeoutMs)
    return () => window.clearTimeout(timer)
  }, [actor, awaiting, timeoutMs])
  return stalled && awaiting !== false && actor.getSnapshot().context.identity === awaiting
}

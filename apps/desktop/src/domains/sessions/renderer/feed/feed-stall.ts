import { useEffect, useState, useSyncExternalStore } from 'react'
import { createActor } from 'xstate'
import { feedStallMachine } from './feed-stall-machine'

// How long the first Feed read may take before the reader sees a stalled state (#2102).
// Stories and tests pass a shortened value instead of waiting on this real bound.
export const FEED_STALL_TIMEOUT_MS = 8000

// The selected Feed bounds its initial read; a running Turn's reply wait has no bound (#3170).
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

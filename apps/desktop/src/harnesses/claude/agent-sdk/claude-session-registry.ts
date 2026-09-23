import type { SessionIdentity } from '@/domains/sessions/next/contract/session-contract'
import type { SessionProjection } from '@/domains/sessions/next/contract/session-projection-contract'
import type { SessionService } from '@/domains/sessions/next/main/session-service'
import { keyOf } from './claude-session-key'
import {
  type ClaudeSessionActor,
  type ClaudeSessionSnapshot,
  projectionFrom,
} from './claude-session-projection'
import { rosterFrom } from './claude-session-roster'

type Listener = (projection: SessionProjection) => void
type Entry = {
  actor: ClaudeSessionActor
  revision: number
  listeners: Set<Listener>
}

function endedUnmanaged(snapshot: ReturnType<ClaudeSessionActor['getSnapshot']>) {
  return snapshot.status === 'done' && snapshot.context.sourceHealth === 'unavailable'
}

export function sessionRegistry(changed: Set<() => void>, sessionService: SessionService) {
  const entries = new Map<string, Entry>()
  const requireEntry = (session: SessionIdentity) => {
    const entry = entries.get(keyOf(session))
    if (entry === undefined) throw new Error('Claude Session is not managed')
    return entry
  }
  const announce = () => {
    for (const listener of changed) listener()
  }
  const record = (actor: ClaudeSessionActor, key: string, snapshot: ClaudeSessionSnapshot) => {
    const entry = entries.get(key) ?? { actor, revision: 0, listeners: new Set<Listener>() }
    entries.set(key, entry)
    entry.revision += 1
    const projection = projectionFrom(snapshot, entry.revision)
    for (const listener of entry.listeners) listener(projection)
    announce()
  }
  const register = (actor: ClaudeSessionActor) =>
    actor.subscribe((snapshot) => {
      const session = snapshot.context.session
      if (session === null) return
      const key = keyOf(session)
      // An actor that ended without a channel drives nothing, and a resume carries its identity in
      // from the caller, so its entry would otherwise keep the Roster calling the Session managed.
      if (endedUnmanaged(snapshot)) {
        entries.delete(key)
        announce()
        return
      }
      record(actor, key, snapshot)
    })
  return {
    entries,
    requireEntry,
    register,
    roster: () =>
      [...entries.values()].flatMap((entry) => rosterFrom(entry.actor.getSnapshot()) ?? []),
    liveMessages: (sessionId: string) =>
      entries.get(keyOf({ harness: 'claude', nativeId: sessionId }))?.actor.getSnapshot().context
        .liveMessages ?? [],
    projection: (session: SessionIdentity) => {
      const entry = entries.get(keyOf(session))
      return entry === undefined ? null : projectionFrom(entry.actor.getSnapshot(), entry.revision)
    },
    close: () =>
      [...entries.values()].forEach((entry) => {
        const session = entry.actor.getSnapshot().context.session
        if (session !== null) sessionService.release(session)
        entry.actor.stop()
      }),
  }
}

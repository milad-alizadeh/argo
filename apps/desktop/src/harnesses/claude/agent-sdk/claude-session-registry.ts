import type { SessionIdentity } from '@/domains/sessions/next/contract/session-contract'
import type { SessionProjection } from '@/domains/sessions/next/contract/session-projection-contract'
import type { SessionService } from '@/domains/sessions/next/main/session-service'
import { keyOf } from './claude-session-key'
import { type ClaudeSessionActor, projectionFrom } from './claude-session-projection'
import { rosterFrom } from './claude-session-roster'

type Entry = {
  actor: ClaudeSessionActor
  revision: number
  listeners: Set<(projection: SessionProjection) => void>
}

export function sessionRegistry(changed: Set<() => void>, sessionService: SessionService) {
  const entries = new Map<string, Entry>()
  const requireEntry = (session: SessionIdentity) => {
    const entry = entries.get(keyOf(session))
    if (entry === undefined) throw new Error('Claude Session is not managed')
    return entry
  }
  const register = (actor: ClaudeSessionActor) =>
    actor.subscribe((snapshot) => {
      if (snapshot.context.session === null) return
      const key = keyOf(snapshot.context.session)
      const entry = entries.get(key) ?? { actor, revision: 0, listeners: new Set() }
      entries.set(key, entry)
      entry.revision += 1
      const projection = projectionFrom(snapshot, entry.revision)
      for (const listener of entry.listeners) listener(projection)
      for (const listener of changed) listener()
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

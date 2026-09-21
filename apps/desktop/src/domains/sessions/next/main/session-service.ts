import type { DatabaseSync } from 'node:sqlite'
import { createActor, setup } from 'xstate'
import {
  type SessionIdentity,
  type SessionPosture,
  sessionIdentitySchema,
} from '@/domains/sessions/next/contract/session-contract'

type ManagedSessionLease = {
  acquire: (request: {
    session: SessionIdentity
    windowId: string
    now: number
    expiresAt: number
  }) => boolean
  renew: (session: SessionIdentity, windowId: string, expiresAt: number) => boolean
  release: (session: SessionIdentity, windowId: string) => void
}

const leaseMachine = setup({
  types: {
    context: {} as SessionIdentity,
    input: {} as SessionIdentity,
    events: {} as { type: 'Lease renewed' } | { type: 'Lease released' },
  },
}).createMachine({
  id: 'managedSessionLeaseMachine',
  context: ({ input }) => input,
  initial: 'Managed',
  states: {
    Managed: {
      on: {
        'Lease renewed': 'Managed',
        'Lease released': 'Released',
      },
    },
    Released: { type: 'final' },
  },
})

function createManagedSessionLease(database: DatabaseSync): ManagedSessionLease {
  database.exec(`
    CREATE TABLE IF NOT EXISTS managed_session_lease (
      harness TEXT NOT NULL,
      native_id TEXT NOT NULL,
      window_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      PRIMARY KEY (harness, native_id)
    ) STRICT;
  `)
  const acquire = database.prepare(`
    INSERT INTO managed_session_lease (harness, native_id, window_id, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (harness, native_id) DO UPDATE SET
      window_id = excluded.window_id,
      expires_at = excluded.expires_at
    WHERE managed_session_lease.window_id = excluded.window_id
      OR managed_session_lease.expires_at <= ?
    RETURNING window_id
  `)
  const renew = database.prepare(`
    UPDATE managed_session_lease
    SET expires_at = ?
    WHERE harness = ? AND native_id = ? AND window_id = ?
    RETURNING window_id
  `)
  const release = database.prepare(`
    DELETE FROM managed_session_lease
    WHERE harness = ? AND native_id = ? AND window_id = ?
  `)

  return {
    acquire: ({ session, windowId, now, expiresAt }) =>
      acquire.get(session.harness, session.nativeId, windowId, expiresAt, now) !== undefined,
    renew: (session, windowId, expiresAt) =>
      renew.get(expiresAt, session.harness, session.nativeId, windowId) !== undefined,
    release: (session, windowId) => {
      release.run(session.harness, session.nativeId, windowId)
    },
  }
}

export type SessionService = {
  acquire: (session: SessionIdentity) => { posture: SessionPosture }
  renew: (session: SessionIdentity) => { posture: SessionPosture }
  release: (session: SessionIdentity) => void
}

export function createSessionService(options: {
  database: DatabaseSync
  windowId: string
  now: () => number
  leaseDurationMs: number
}): SessionService {
  const lease = createManagedSessionLease(options.database)
  const actors = new Map<string, ReturnType<typeof createActor<typeof leaseMachine>>>()
  const keyOf = (session: SessionIdentity) => `${session.harness}:${session.nativeId}`
  const managed = (): { posture: 'managed' } => ({ posture: 'managed' })
  const watched = (): { posture: 'watched' } => ({ posture: 'watched' })

  return {
    acquire: (session) => {
      const identity = sessionIdentitySchema.parse(session)
      const now = options.now()
      if (
        !lease.acquire({
          session: identity,
          windowId: options.windowId,
          now,
          expiresAt: now + options.leaseDurationMs,
        })
      ) {
        return watched()
      }
      const previous = actors.get(keyOf(identity))
      if (previous !== undefined) {
        previous.send({ type: 'Lease renewed' })
        return managed()
      }
      const actor = createActor(leaseMachine, { input: identity }).start()
      actors.set(keyOf(identity), actor)
      return managed()
    },
    renew: (session) => {
      const identity = sessionIdentitySchema.parse(session)
      const actor = actors.get(keyOf(identity))
      if (actor === undefined) return watched()
      if (!lease.renew(identity, options.windowId, options.now() + options.leaseDurationMs)) {
        actor.send({ type: 'Lease released' })
        actor.stop()
        actors.delete(keyOf(identity))
        return watched()
      }
      actor.send({ type: 'Lease renewed' })
      return managed()
    },
    release: (session) => {
      const identity = sessionIdentitySchema.parse(session)
      lease.release(identity, options.windowId)
      const actor = actors.get(keyOf(identity))
      if (actor === undefined) return
      actor.send({ type: 'Lease released' })
      actor.stop()
      actors.delete(keyOf(identity))
    },
  }
}

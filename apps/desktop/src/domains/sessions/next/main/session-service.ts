import { and, eq, lte, or } from 'drizzle-orm'
import { createActor, setup } from 'xstate'
import {
  type SessionIdentity,
  type SessionPosture,
  sessionIdentitySchema,
} from '@/domains/sessions/next/contract/session-contract'
import { managedSessionLease } from '@/platform/main/storage/database-schema'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'

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

function createManagedSessionLease(database: DurableDatabase): ManagedSessionLease {
  return {
    acquire: ({ session, windowId, now, expiresAt }) =>
      database
        .insert(managedSessionLease)
        .values({
          harness: session.harness,
          nativeId: session.nativeId,
          windowId,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: [managedSessionLease.harness, managedSessionLease.nativeId],
          set: { windowId, expiresAt },
          setWhere: or(
            eq(managedSessionLease.windowId, windowId),
            lte(managedSessionLease.expiresAt, now),
          ),
        })
        .returning({ windowId: managedSessionLease.windowId })
        .get() !== undefined,
    renew: (session, windowId, expiresAt) =>
      database
        .update(managedSessionLease)
        .set({ expiresAt })
        .where(
          and(
            eq(managedSessionLease.harness, session.harness),
            eq(managedSessionLease.nativeId, session.nativeId),
            eq(managedSessionLease.windowId, windowId),
          ),
        )
        .returning({ windowId: managedSessionLease.windowId })
        .get() !== undefined,
    release: (session, windowId) => {
      database
        .delete(managedSessionLease)
        .where(
          and(
            eq(managedSessionLease.harness, session.harness),
            eq(managedSessionLease.nativeId, session.nativeId),
            eq(managedSessionLease.windowId, windowId),
          ),
        )
        .run()
    },
  }
}

export type SessionService = {
  acquire: (session: SessionIdentity) => { posture: SessionPosture }
  renew: (session: SessionIdentity) => { posture: SessionPosture }
  release: (session: SessionIdentity) => void
}

export function createSessionService(options: {
  database: DurableDatabase
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

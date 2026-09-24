import { randomUUID } from 'node:crypto'
import { and, eq, gt, lte } from 'drizzle-orm'
import { createActor, setup } from 'xstate'
import {
  type SessionIdentity,
  type SessionPosture,
  sessionIdentitySchema,
} from '@/domains/sessions/next/contract/session-contract'
import { managedSessionLease } from '@/domains/sessions/next/main/schema'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'

type ManagedSessionLease = {
  acquire: (request: {
    session: SessionIdentity
    ownerToken: string
    windowId: string
    now: number
    expiresAt: number
  }) => boolean
  renew: (request: {
    session: SessionIdentity
    ownerToken: string
    now: number
    expiresAt: number
  }) => boolean
  release: (session: SessionIdentity, ownerToken: string, now: number) => void
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
    acquire: ({ session, ownerToken, windowId, now, expiresAt }) =>
      database
        .insert(managedSessionLease)
        .values({
          harness: session.harness,
          nativeId: session.nativeId,
          windowId,
          ownerToken,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: [managedSessionLease.harness, managedSessionLease.nativeId],
          set: { windowId, ownerToken, expiresAt },
          setWhere: lte(managedSessionLease.expiresAt, now),
        })
        .returning({ windowId: managedSessionLease.windowId })
        .get() !== undefined,
    renew: ({ session, ownerToken, now, expiresAt }) =>
      database
        .update(managedSessionLease)
        .set({ expiresAt })
        .where(
          and(
            eq(managedSessionLease.harness, session.harness),
            eq(managedSessionLease.nativeId, session.nativeId),
            eq(managedSessionLease.ownerToken, ownerToken),
            gt(managedSessionLease.expiresAt, now),
          ),
        )
        .returning({ windowId: managedSessionLease.windowId })
        .get() !== undefined,
    release: (session, ownerToken, now) => {
      database
        .delete(managedSessionLease)
        .where(
          and(
            eq(managedSessionLease.harness, session.harness),
            eq(managedSessionLease.nativeId, session.nativeId),
            eq(managedSessionLease.ownerToken, ownerToken),
            gt(managedSessionLease.expiresAt, now),
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

class ManagedSessionService implements SessionService {
  private readonly lease: ManagedSessionLease
  private readonly actors = new Map<string, ReturnType<typeof createActor<typeof leaseMachine>>>()
  private readonly tokens = new Map<string, string>()
  private readonly options: {
    database: DurableDatabase
    windowId: string
    now: () => number
    leaseDurationMs: number
  }

  constructor(options: {
    database: DurableDatabase
    windowId: string
    now: () => number
    leaseDurationMs: number
  }) {
    this.options = options
    this.lease = createManagedSessionLease(options.database)
  }

  private keyOf(session: SessionIdentity): string {
    return `${session.harness}:${session.nativeId}`
  }

  private drop(key: string): void {
    const actor = this.actors.get(key)
    actor?.send({ type: 'Lease released' })
    actor?.stop()
    this.actors.delete(key)
    this.tokens.delete(key)
  }

  acquire(session: SessionIdentity): { posture: SessionPosture } {
    const identity = sessionIdentitySchema.parse(session)
    const key = this.keyOf(identity)
    const now = this.options.now()
    const heldToken = this.tokens.get(key)
    if (
      heldToken !== undefined &&
      this.lease.renew({
        session: identity,
        ownerToken: heldToken,
        now,
        expiresAt: now + this.options.leaseDurationMs,
      })
    ) {
      this.actors.get(key)?.send({ type: 'Lease renewed' })
      return { posture: 'managed' }
    }
    this.drop(key)
    const ownerToken = randomUUID()
    if (
      !this.lease.acquire({
        session: identity,
        ownerToken,
        windowId: this.options.windowId,
        now,
        expiresAt: now + this.options.leaseDurationMs,
      })
    )
      return { posture: 'watched' }
    this.tokens.set(key, ownerToken)
    this.actors.set(key, createActor(leaseMachine, { input: identity }).start())
    return { posture: 'managed' }
  }

  renew(session: SessionIdentity): { posture: SessionPosture } {
    const identity = sessionIdentitySchema.parse(session)
    const key = this.keyOf(identity)
    const token = this.tokens.get(key)
    const now = this.options.now()
    if (
      token !== undefined &&
      this.lease.renew({
        session: identity,
        ownerToken: token,
        now,
        expiresAt: now + this.options.leaseDurationMs,
      })
    ) {
      this.actors.get(key)?.send({ type: 'Lease renewed' })
      return { posture: 'managed' }
    }
    this.drop(key)
    return { posture: 'watched' }
  }

  release(session: SessionIdentity): void {
    const identity = sessionIdentitySchema.parse(session)
    const key = this.keyOf(identity)
    const token = this.tokens.get(key)
    if (token !== undefined) this.lease.release(identity, token, this.options.now())
    this.drop(key)
  }
}

export function createSessionService(options: {
  database: DurableDatabase
  windowId: string
  now: () => number
  leaseDurationMs: number
}): SessionService {
  return new ManagedSessionService(options)
}

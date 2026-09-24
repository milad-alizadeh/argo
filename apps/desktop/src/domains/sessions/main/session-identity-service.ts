import { randomUUID } from 'node:crypto'
import { and, eq, or } from 'drizzle-orm'
import { z } from 'zod'
import { harnessSchema } from '@/domains/sessions/next/contract/session-contract'
import {
  managedSessionLease,
  session,
  sessionLaunchIntent,
} from '@/domains/sessions/next/main/schema'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'

const vendorIdentitySchema = z.strictObject({
  harness: harnessSchema,
  nativeId: z.string().min(1),
})
const discoverySchema = vendorIdentitySchema.extend({
  projectId: z.string().min(1),
  firstPrompt: z.string().nullable(),
})
const launchInputSchema = z.strictObject({
  harness: harnessSchema,
  projectId: z.string().min(1),
  workspaceId: z.string().min(1),
  prompt: z.string().trim().min(1),
})

export type PendingSessionLaunch = {
  id: string
  harness: z.infer<typeof harnessSchema>
  projectId: string
  workspaceId: string
  prompt: string
  createdAt: number
  nativeId: string | null
}

export type VendorSessionRead =
  | {
      kind: 'permanently-unrecoverable'
      authenticated: true
      harness: z.infer<typeof harnessSchema>
      nativeId: string
    }
  | { kind: 'inaccessible' | 'temporarily-unavailable' | 'ambiguous' | 'found' }

export type LaunchDiscovery =
  | { kind: 'found'; nativeId: string }
  | { kind: 'ambiguous' | 'unavailable' }

export class SessionIdentityService {
  private readonly inProcessNativeIds = new Map<string, string>()
  private unsafeStorage = false
  private readonly database: DurableDatabase
  private readonly now: () => number
  private readonly removeTicketLink: (sessionId: string) => Promise<void>

  constructor(
    database: DurableDatabase,
    removeTicketLink: (sessionId: string) => Promise<void>,
    now: () => number = Date.now,
  ) {
    this.database = database
    this.removeTicketLink = removeTicketLink
    this.now = now
  }

  private fail(error: unknown): never {
    this.unsafeStorage = true
    throw error
  }

  isUnsafe(): boolean {
    return this.unsafeStorage
  }

  reconcile(rawInput: z.input<typeof discoverySchema>): string {
    const identity = discoverySchema.parse(rawInput)
    try {
      return this.database.transaction((transaction) => {
        transaction
          .insert(session)
          .values({
            argoId: randomUUID(),
            projectId: identity.projectId,
            harness: identity.harness,
            nativeId: identity.nativeId,
            firstPrompt: identity.firstPrompt,
            title: null,
            updatedAt: this.now(),
          })
          .onConflictDoNothing()
          .run()
        const row = transaction
          .select({ argoId: session.argoId })
          .from(session)
          .where(
            and(eq(session.harness, identity.harness), eq(session.nativeId, identity.nativeId)),
          )
          .get()
        if (row === undefined) throw new Error('Session identity was not committed')
        return row.argoId
      })
    } catch (error) {
      return this.fail(error)
    }
  }

  beginLaunch(rawInput: z.input<typeof launchInputSchema>): string {
    const input = launchInputSchema.parse(rawInput)
    if (this.unsafeStorage) throw new Error('Durable Session storage is unsafe')
    const id = randomUUID()
    try {
      this.database
        .insert(sessionLaunchIntent)
        .values({
          id,
          harness: input.harness,
          projectId: input.projectId,
          workspaceId: input.workspaceId,
          prompt: input.prompt,
          createdAt: this.now(),
          nativeId: null,
          status: 'starting',
        })
        .run()
      return id
    } catch (error) {
      return this.fail(error)
    }
  }

  rememberVendorStart(intentId: string, nativeId: string | null): void {
    if (nativeId !== null && nativeId.length > 0) this.inProcessNativeIds.set(intentId, nativeId)
    try {
      this.database
        .update(sessionLaunchIntent)
        .set({
          nativeId: nativeId && nativeId.length > 0 ? nativeId : null,
          status: 'uncertain',
        })
        .where(eq(sessionLaunchIntent.id, intentId))
        .run()
    } catch {
      this.unsafeStorage = true
    }
  }

  rejectLaunch(intentId: string): void {
    try {
      this.database
        .update(sessionLaunchIntent)
        .set({ status: 'rejected' })
        .where(eq(sessionLaunchIntent.id, intentId))
        .run()
    } catch (error) {
      this.fail(error)
    }
  }

  commitLaunch(intentId: string, nativeId: string): string {
    if (nativeId.length === 0) throw new Error('Vendor returned no recoverable Session ID')
    this.inProcessNativeIds.set(intentId, nativeId)
    try {
      return this.database.transaction((transaction) => {
        const intent = transaction
          .select()
          .from(sessionLaunchIntent)
          .where(eq(sessionLaunchIntent.id, intentId))
          .get()
        if (intent === undefined || intent.status === 'rejected') {
          throw new Error('Session launch intent is unavailable')
        }
        if (intent.nativeId !== null && intent.nativeId !== nativeId) {
          throw new Error('Session launch intent belongs to another native ID')
        }
        const harness = harnessSchema.parse(intent.harness)
        transaction
          .insert(session)
          .values({
            argoId: randomUUID(),
            projectId: intent.projectId,
            harness,
            nativeId,
            title: null,
            firstPrompt: intent.prompt,
            updatedAt: this.now(),
          })
          .onConflictDoNothing()
          .run()
        const row = transaction
          .select({ argoId: session.argoId })
          .from(session)
          .where(and(eq(session.harness, harness), eq(session.nativeId, nativeId)))
          .get()
        if (row === undefined) throw new Error('Session identity was not committed')
        transaction
          .update(sessionLaunchIntent)
          .set({ nativeId, status: 'committed' })
          .where(eq(sessionLaunchIntent.id, intentId))
          .run()
        return row.argoId
      })
    } catch (error) {
      return this.fail(error)
    }
  }

  pendingLaunches(): PendingSessionLaunch[] {
    return this.database
      .select()
      .from(sessionLaunchIntent)
      .where(
        or(eq(sessionLaunchIntent.status, 'starting'), eq(sessionLaunchIntent.status, 'uncertain')),
      )
      .all()
      .map((row) => ({
        id: row.id,
        harness: harnessSchema.parse(row.harness),
        projectId: row.projectId,
        workspaceId: row.workspaceId,
        prompt: row.prompt,
        createdAt: row.createdAt,
        nativeId: this.inProcessNativeIds.get(row.id) ?? row.nativeId,
      }))
  }

  async recoverLaunches(
    discover: (intent: PendingSessionLaunch) => Promise<LaunchDiscovery>,
  ): Promise<string[]> {
    const recovered: string[] = []
    for (const intent of this.pendingLaunches()) {
      let discovery: LaunchDiscovery
      try {
        discovery =
          intent.nativeId === null
            ? await discover(intent)
            : { kind: 'found', nativeId: intent.nativeId }
      } catch {
        continue
      }
      if (discovery.kind !== 'found' || discovery.nativeId.length === 0) continue
      this.rememberVendorStart(intent.id, discovery.nativeId)
      recovered.push(this.commitLaunch(intent.id, discovery.nativeId))
    }
    return recovered
  }

  async removeAfterVendorRead(result: VendorSessionRead): Promise<boolean> {
    if (result.kind !== 'permanently-unrecoverable' || result.authenticated !== true) return false
    const identity = vendorIdentitySchema.parse({
      harness: result.harness,
      nativeId: result.nativeId,
    })
    const row = this.database
      .select({ argoId: session.argoId })
      .from(session)
      .where(and(eq(session.harness, identity.harness), eq(session.nativeId, identity.nativeId)))
      .get()
    if (row === undefined) return false
    try {
      await this.removeTicketLink(row.argoId)
      await this.removeTicketLink(identity.nativeId)
      this.database.transaction((transaction) => {
        transaction
          .delete(managedSessionLease)
          .where(
            and(
              eq(managedSessionLease.harness, identity.harness),
              eq(managedSessionLease.nativeId, identity.nativeId),
            ),
          )
          .run()
        transaction
          .delete(sessionLaunchIntent)
          .where(
            and(
              eq(sessionLaunchIntent.harness, identity.harness),
              eq(sessionLaunchIntent.nativeId, identity.nativeId),
            ),
          )
          .run()
        transaction.delete(session).where(eq(session.argoId, row.argoId)).run()
      })
      return true
    } catch (error) {
      return this.fail(error)
    }
  }
}

export function createSessionIdentityService(
  database: DurableDatabase,
  removeTicketLink: (sessionId: string) => Promise<void>,
  now: () => number = Date.now,
): SessionIdentityService {
  return new SessionIdentityService(database, removeTicketLink, now)
}

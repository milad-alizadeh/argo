import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { discoveredSessionSchema } from '@/domains/sessions/contract/session-discovery'
import { harnessSchema } from '@/domains/sessions/next/contract/session-contract'
import { session } from '@/domains/sessions/next/main/schema'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'

const storedSessionSchema = discoveredSessionSchema.omit({ workspaceId: true }).extend({
  projectId: z.string().min(1),
})

export type VendorSessionRead =
  | {
      kind: 'permanently-unrecoverable'
      authenticated: true
      harness: z.infer<typeof harnessSchema>
      nativeId: string
    }
  | { kind: 'inaccessible' | 'temporarily-unavailable' | 'ambiguous' | 'found' }

export class SessionRepository {
  private vendorReadOffset = 0
  private readonly database: DurableDatabase
  private readonly removeTicketLink: (argoId: string) => Promise<void>
  private readonly now: () => number

  constructor(
    database: DurableDatabase,
    removeTicketLink: (argoId: string) => Promise<void>,
    now: () => number = Date.now,
  ) {
    this.database = database
    this.removeTicketLink = removeTicketLink
    this.now = now
  }

  upsert(rawInput: z.input<typeof storedSessionSchema>): string {
    const input = storedSessionSchema.parse(rawInput)
    return this.database.transaction((transaction) => {
      transaction
        .insert(session)
        .values({
          argoId: randomUUID(),
          projectId: input.projectId,
          harness: input.harness,
          nativeId: input.nativeId,
          firstPrompt: input.firstPrompt,
          title: null,
          updatedAt: this.now(),
        })
        .onConflictDoNothing()
        .run()
      const row = transaction
        .select({ argoId: session.argoId })
        .from(session)
        .where(and(eq(session.harness, input.harness), eq(session.nativeId, input.nativeId)))
        .get()
      if (row === undefined) throw new Error('Session identity was not committed')
      return row.argoId
    })
  }

  async reconcileVendorReads(
    read: (identity: {
      harness: z.infer<typeof harnessSchema>
      nativeId: string
    }) => Promise<VendorSessionRead>,
  ): Promise<number> {
    let removed = 0
    const rows = this.database.select().from(session).orderBy(session.argoId).all()
    const count = Math.min(rows.length, 10)
    const start = this.vendorReadOffset
    this.vendorReadOffset = rows.length === 0 ? 0 : (start + count) % rows.length
    for (let index = 0; index < count; index += 1) {
      const row = rows[(start + index) % rows.length]
      if (row === undefined) continue
      const identity = { harness: harnessSchema.parse(row.harness), nativeId: row.nativeId }
      let result: VendorSessionRead
      try {
        result = await read(identity)
      } catch {
        continue
      }
      if (
        result.kind === 'permanently-unrecoverable' &&
        result.harness === identity.harness &&
        result.nativeId === identity.nativeId &&
        (await this.removeAfterVendorRead(result))
      ) {
        removed += 1
      }
    }
    return removed
  }

  private async removeAfterVendorRead(
    result: Extract<VendorSessionRead, { kind: 'permanently-unrecoverable' }>,
  ): Promise<boolean> {
    if (result.authenticated !== true) return false
    const row = this.database
      .select({ argoId: session.argoId })
      .from(session)
      .where(and(eq(session.harness, result.harness), eq(session.nativeId, result.nativeId)))
      .get()
    if (row === undefined) return false
    await this.removeTicketLink(row.argoId)
    this.database.delete(session).where(eq(session.argoId, row.argoId)).run()
    return true
  }
}

export function createSessionRepository(
  database: DurableDatabase,
  removeTicketLink: (argoId: string) => Promise<void>,
  now: () => number = Date.now,
): SessionRepository {
  return new SessionRepository(database, removeTicketLink, now)
}

// The one write of provider Ticket facts into SQLite: one identity per native ID, facts replaced.
import { and, eq, lt } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { ticketTable } from '@/database/ticket/schema'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import { ticketContent } from '@/database/ticket-content/schema'
import { nextUpdatedAt } from '@/database/timestamp-columns'
import type { Ticket } from '@/domains/tickets/contract/contract'

// `readAt` is when the page was asked for; a Ticket written since keeps its newer facts.
export type ListedBatch = TicketScopeTarget & {
  scanStartedAt: number
  offset: number
  readAt: number
}
type Writer = Pick<Database, 'insert' | 'select' | 'update'>

const touched = nextUpdatedAt(ticketContent.updatedAt)

function facts(ticket: Ticket) {
  return {
    key: ticket.key,
    url: ticket.url,
    title: ticket.title,
    body: ticket.body,
    state: ticket.state,
    statusJson: JSON.stringify(ticket.status),
    priorityJson: ticket.priority === null ? null : JSON.stringify(ticket.priority),
    providerCreatedAt: ticket.createdAt,
    labelsJson: JSON.stringify(ticket.labels),
    type: ticket.type,
    childrenJson: JSON.stringify(ticket.children),
    blockedByJson: ticket.blockedBy === null ? null : JSON.stringify(ticket.blockedBy),
  }
}

// The identity behind a native ID within the scope.
function savedIdentity(database: Writer, { provider, scope }: TicketScopeTarget, nativeId: string) {
  return database
    .select({ argoId: ticketTable.argoId })
    .from(ticketTable)
    .where(
      and(
        eq(ticketTable.provider, provider),
        eq(ticketTable.scope, scope),
        eq(ticketTable.nativeId, nativeId),
      ),
    )
    .get()?.argoId
}

// A Ticket addressed by its key, which is not its native ID where the key can change.
function savedIdentityByKey(database: Writer, { provider, scope }: TicketScopeTarget, key: string) {
  return database
    .select({ argoId: ticketTable.argoId })
    .from(ticketTable)
    .innerJoin(ticketContent, eq(ticketContent.ticketId, ticketTable.argoId))
    .where(
      and(
        eq(ticketTable.provider, provider),
        eq(ticketTable.scope, scope),
        eq(ticketContent.key, key),
      ),
    )
    .get()?.argoId
}

function identity(database: Writer, target: TicketScopeTarget, nativeId: string) {
  const { provider, scope } = target
  database
    .insert(ticketTable)
    .values({ argoId: crypto.randomUUID(), provider, scope, nativeId })
    .onConflictDoNothing()
    .run()
  const argoId = savedIdentity(database, target, nativeId)
  if (argoId === undefined) throw new Error('Ticket identity did not persist.')
  return argoId
}

// One page of an active scan, committed together, in the provider's order.
export function saveListedTickets(
  database: Database,
  batch: ListedBatch,
  tickets: readonly Ticket[],
): void {
  database.transaction((transaction) => {
    tickets.forEach((ticket, index) => {
      const ticketId = identity(transaction, batch, ticket.nativeId ?? ticket.key)
      const listed = { position: batch.offset + index, listedAt: batch.scanStartedAt }
      transaction
        .insert(ticketContent)
        .values({ ticketId, ...facts(ticket), ...listed })
        .onConflictDoUpdate({
          target: ticketContent.ticketId,
          set: { ...facts(ticket), updatedAt: touched },
          setWhere: lt(ticketContent.updatedAt, batch.readAt),
        })
        .run()
      transaction
        .update(ticketContent)
        .set(listed)
        .where(eq(ticketContent.ticketId, ticketId))
        .run()
    })
  })
}

// A field the provider confirmed after a write, saved on the Ticket's existing row.
export function saveConfirmedFields(
  database: Database,
  target: TicketScopeTarget & { key: string },
  fields: Partial<Pick<Ticket, 'status' | 'state' | 'priority'>>,
): void {
  const set = {
    ...(fields.status === undefined ? {} : { statusJson: JSON.stringify(fields.status) }),
    ...(fields.state === undefined ? {} : { state: fields.state }),
    ...(fields.priority === undefined
      ? {}
      : { priorityJson: fields.priority === null ? null : JSON.stringify(fields.priority) }),
  }
  const ticketId = savedIdentityByKey(database, target, target.key)
  if (ticketId === undefined) return
  database
    .update(ticketContent)
    .set({ ...set, updatedAt: touched })
    .where(eq(ticketContent.ticketId, ticketId))
    .run()
}

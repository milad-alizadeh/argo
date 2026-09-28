// The one write of provider Ticket facts into SQLite. An identity is created once per provider,
// scope and native ID; every later read replaces the facts beside it.
import { and, eq, sql } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { ticketTable } from '@/database/ticket/schema'
import { ticketContent } from '@/database/ticket-content/schema'
import type { Provider } from '@/domains/accounts/contract/contract'
import type { Ticket } from '@/domains/tickets/contract/contract'

export type TicketScopeTarget = { provider: Provider; scope: string }
export type ListedBatch = TicketScopeTarget & { scanStartedAt: number; offset: number }

const touched = sql`MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), ${ticketContent.updatedAt} + 1)`

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

// The Ticket's key is its native ID within the scope.
function identity(database: Database, { provider, scope }: TicketScopeTarget, nativeId: string) {
  database
    .insert(ticketTable)
    .values({ argoId: crypto.randomUUID(), provider, scope, nativeId })
    .onConflictDoNothing()
    .run()
  const row = database
    .select({ argoId: ticketTable.argoId })
    .from(ticketTable)
    .where(
      and(
        eq(ticketTable.provider, provider),
        eq(ticketTable.scope, scope),
        eq(ticketTable.nativeId, nativeId),
      ),
    )
    .get()
  if (row === undefined) throw new Error('Ticket identity did not persist.')
  return row.argoId
}

function transaction(database: Database, write: () => void): void {
  database.$client.exec('BEGIN IMMEDIATE')
  try {
    write()
    database.$client.exec('COMMIT')
  } catch (error) {
    database.$client.exec('ROLLBACK')
    throw error
  }
}

// One page of an active scan, committed together, in the provider's order.
export function saveListedTickets(
  database: Database,
  batch: ListedBatch,
  tickets: readonly Ticket[],
): void {
  transaction(database, () => {
    tickets.forEach((ticket, index) => {
      const ticketId = identity(database, batch, ticket.key)
      const listed = { position: batch.offset + index, listedAt: batch.scanStartedAt }
      database
        .insert(ticketContent)
        .values({ ticketId, ...facts(ticket), ...listed })
        .onConflictDoUpdate({
          target: ticketContent.ticketId,
          set: { ...facts(ticket), ...listed, updatedAt: touched },
        })
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
  const owner = database
    .select({ argoId: ticketTable.argoId })
    .from(ticketTable)
    .where(
      and(
        eq(ticketTable.provider, target.provider),
        eq(ticketTable.scope, target.scope),
        eq(ticketTable.nativeId, target.key),
      ),
    )
    .get()
  if (owner === undefined) return
  database
    .update(ticketContent)
    .set({ ...set, updatedAt: touched })
    .where(eq(ticketContent.ticketId, owner.argoId))
    .run()
}

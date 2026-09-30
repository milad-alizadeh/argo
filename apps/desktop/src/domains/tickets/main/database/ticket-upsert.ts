// The one write of provider Ticket facts into SQLite: one identity per native ID, facts replaced.
import { and, count, eq, inArray, isNotNull, lt } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { ticketTable } from '@/database/ticket/schema'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import { ticketContent } from '@/database/ticket-content/schema'
import { ticketSearch } from '@/database/ticket-search/schema'
import { ticketSearchTicketLink } from '@/database/ticket-search-ticket-link/schema'
import { nextUpdatedAt } from '@/database/timestamp-columns'
import type { Ticket } from '@/domains/tickets/api/ticket'
import { matchingSearch } from './ticket-search-records'

// `readAt` is when the page was asked for; a Ticket written since keeps its newer facts.
export type ListedBatch = TicketScopeTarget & {
  scanStartedAt: number
  offset: number
  readAt: number
}
type Writer = Pick<Database, 'insert' | 'select' | 'update'>

const touched = nextUpdatedAt(ticketContent.updatedAt)
const searchTouched = nextUpdatedAt(ticketSearch.updatedAt)

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
    deletedAt: null,
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
export function savedIdentityByKey(
  database: Writer,
  { provider, scope }: TicketScopeTarget,
  key: string,
) {
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

// The Ticket's identity and facts; a row written after `readAt` keeps its newer facts.
function saveFacts(
  database: Writer,
  target: TicketScopeTarget & { readAt: number },
  ticket: Ticket,
): string {
  const ticketId = identity(database, target, ticket.nativeId ?? ticket.key)
  database
    .insert(ticketContent)
    .values({ ticketId, ...facts(ticket) })
    .onConflictDoUpdate({
      target: ticketContent.ticketId,
      set: { ...facts(ticket), updatedAt: touched },
      setWhere: lt(ticketContent.updatedAt, target.readAt),
    })
    .run()
  return ticketId
}

// One page of an active scan, committed together, in the provider's order.
export function saveListedTickets(
  database: Database,
  batch: ListedBatch,
  tickets: readonly Ticket[],
): void {
  database.transaction((transaction) => {
    tickets.forEach((ticket, index) => {
      const ticketId = saveFacts(transaction, batch, ticket)
      transaction
        .update(ticketContent)
        .set({ position: batch.offset + index, listedAt: batch.scanStartedAt })
        .where(eq(ticketContent.ticketId, ticketId))
        .run()
    })
  })
}

// One page of Closed Tickets, committed together. The first page starts the listing over, so the
// pages after it number on from it.
export function saveClosedTickets(
  database: Database,
  batch: TicketScopeTarget & { offset: number; readAt: number; first: boolean },
  tickets: readonly Ticket[],
): void {
  database.transaction((transaction) => {
    if (batch.first) clearClosedListing(transaction, batch)
    tickets.forEach((ticket, index) => {
      const ticketId = saveFacts(transaction, batch, ticket)
      transaction
        .update(ticketContent)
        .set({ closedPosition: batch.offset + index })
        .where(eq(ticketContent.ticketId, ticketId))
        .run()
    })
  })
}

const inTicketScope = ({ provider, scope }: TicketScopeTarget) =>
  and(eq(ticketTable.provider, provider), eq(ticketTable.scope, scope))

function clearClosedListing(database: Writer, target: TicketScopeTarget): void {
  const ids = database
    .select({ argoId: ticketTable.argoId })
    .from(ticketTable)
    .where(inTicketScope(target))
  database
    .update(ticketContent)
    .set({ closedPosition: null })
    .where(inArray(ticketContent.ticketId, ids))
    .run()
}

// The number of Closed Tickets the listing holds, which is where the next page numbers from.
export function countClosedListed(database: Database, target: TicketScopeTarget) {
  return (
    database
      .select({ value: count() })
      .from(ticketContent)
      .innerJoin(ticketTable, eq(ticketTable.argoId, ticketContent.ticketId))
      .where(and(inTicketScope(target), isNotNull(ticketContent.closedPosition)))
      .get()?.value ?? 0
  )
}

// One Ticket read by ID, answering its Argo UUID; only the active scan sets its listing.
export function saveReadTicket(
  database: Database,
  target: TicketScopeTarget & { readAt: number },
  ticket: Ticket,
): string {
  return database.transaction((transaction) => saveFacts(transaction, target, ticket))
}

// The provider's matches for a query, saved as Tickets and linked to the query in the provider's
// order. A Ticket the listing does not hold stays unlisted, so only the search shows it.
export function saveSearchedTickets(
  database: Database,
  target: TicketScopeTarget & { query: string; readAt: number; completedAt: number },
  tickets: readonly Ticket[],
): void {
  const { provider, scope, query } = target
  database.transaction((transaction) => {
    const ticketIds = tickets.map((ticket) => saveFacts(transaction, target, ticket))
    transaction
      .delete(ticketSearchTicketLink)
      .where(
        and(
          eq(ticketSearchTicketLink.provider, provider),
          eq(ticketSearchTicketLink.scope, scope),
          eq(ticketSearchTicketLink.query, query),
        ),
      )
      .run()
    ticketIds.forEach((ticketId, position) => {
      transaction
        .insert(ticketSearchTicketLink)
        .values({ provider, scope, query, ticketId, position })
        .onConflictDoNothing()
        .run()
    })
    transaction
      .update(ticketSearch)
      .set({
        phase: 'ready',
        failure: null,
        completedAt: target.completedAt,
        updatedAt: searchTouched,
      })
      .where(matchingSearch(target))
      .run()
  })
}

// A field the provider confirmed after a write, saved on the Ticket's existing row.
export function saveConfirmedFields(
  database: Writer,
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

// What the provider answered when an omitted Ticket was read by its native ID.
export type OmittedOutcome =
  | { kind: 'read'; ticket: Ticket }
  | { kind: 'deleted'; at: number }
  | { kind: 'elsewhere' }

// The native IDs of Tickets an earlier scan listed that the scan starting at `scanStartedAt` did not.
export function omittedNativeIds(
  database: Database,
  target: TicketScopeTarget,
  scanStartedAt: number,
): string[] {
  return database
    .select({ nativeId: ticketTable.nativeId })
    .from(ticketContent)
    .innerJoin(ticketTable, eq(ticketTable.argoId, ticketContent.ticketId))
    .where(
      and(
        inTicketScope(target),
        isNotNull(ticketContent.listedAt),
        lt(ticketContent.listedAt, scanStartedAt),
      ),
    )
    .orderBy(ticketContent.position)
    .all()
    .map(({ nativeId }) => nativeId)
}

// One omitted Ticket settled by the provider's answer; it is never read again, and a deletion keeps the row.
export function saveOmittedTicket(
  database: Database,
  target: TicketScopeTarget & { nativeId: string; readAt: number },
  outcome: OmittedOutcome,
): void {
  database.transaction((transaction) => {
    const ticketId = savedIdentity(transaction, target, target.nativeId)
    if (ticketId === undefined) return
    switch (outcome.kind) {
      case 'read':
        saveFacts(transaction, target, outcome.ticket)
        break
      case 'deleted':
        transaction
          .update(ticketContent)
          .set({ deletedAt: outcome.at, updatedAt: touched })
          // A row written since the read keeps its newer facts, as in every other write.
          .where(
            and(eq(ticketContent.ticketId, ticketId), lt(ticketContent.updatedAt, target.readAt)),
          )
          .run()
        break
      case 'elsewhere':
        break
    }
    transaction
      .update(ticketContent)
      .set({ listedAt: null, position: null })
      .where(eq(ticketContent.ticketId, ticketId))
      .run()
  })
}

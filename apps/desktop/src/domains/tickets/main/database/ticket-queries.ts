// The Ticket screen's reads from SQLite alone: active means listed by the latest complete scan or later.
import {
  type AnyColumn,
  and,
  asc,
  count,
  eq,
  gte,
  isNotNull,
  isNull,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { ticketTable } from '@/database/ticket/schema'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import { ticketContent } from '@/database/ticket-content/schema'
import { ticketContentSelectSchema } from '@/database/ticket-content/validation'
import { ticketSearch } from '@/database/ticket-search/schema'
import {
  type TicketSearchState,
  ticketSearchSelectSchema,
} from '@/database/ticket-search/validation'
import { ticketSearchTicketLink } from '@/database/ticket-search-ticket-link/schema'
import { ticketSync } from '@/database/ticket-sync/schema'
import { type TicketSyncState, ticketSyncSelectSchema } from '@/database/ticket-sync/validation'
import type { Ticket, TicketStatus } from '@/domains/tickets/api/ticket'
import { ticket, ticketStatus } from '@/domains/tickets/api/ticket'
import { matchingSearch } from './ticket-search-records'
import { matchingScan, type TicketSyncTarget } from './ticket-sync-records'

type ActiveRead = {
  tickets: Ticket[]
  statuses: TicketStatus[]
  total: number
  sync: TicketSyncState
}
type ContentRow = typeof ticketContent.$inferSelect
// One saved Ticket, whether or not the active list still holds it.
export type SavedTicket = { argoId: string; nativeId: string; ticket: Ticket }

const IDLE: TicketSyncState = { phase: 'idle', failure: null, complete: false, completedAt: null }
const IDLE_SEARCH: TicketSearchState = { phase: 'idle', failure: null, completedAt: null }
const statuses = z.array(ticketStatus)

function ticketFrom(saved: ContentRow): Ticket {
  const row = ticketContentSelectSchema.parse(saved)
  return ticket.parse({
    key: row.key,
    url: row.url,
    title: row.title,
    body: row.body,
    state: row.state,
    status: JSON.parse(row.statusJson),
    priority: row.priorityJson === null ? null : JSON.parse(row.priorityJson),
    createdAt: row.providerCreatedAt,
    labels: JSON.parse(row.labelsJson),
    type: row.type,
    children: JSON.parse(row.childrenJson),
    blockedBy: row.blockedByJson === null ? null : JSON.parse(row.blockedByJson),
  })
}

function readSync(
  database: Database,
  { provider, scope }: TicketScopeTarget,
  kind: TicketSyncTarget['kind'] = 'active',
) {
  const row = database
    .select()
    .from(ticketSync)
    .where(matchingScan({ provider, scope, kind }))
    .get()
  if (row === undefined) return { state: IDLE, statuses: [], coveredFrom: 0 }
  const saved = ticketSyncSelectSchema.parse(row)
  const state: TicketSyncState = {
    phase: saved.phase,
    // Kept through a retry's scan, so the screen does not drop the failure while it retries.
    failure: saved.failure,
    completedAt: saved.completedAt,
    // A Closed listing is complete once its last page was saved.
    complete:
      kind === 'closed'
        ? saved.nextCursor === null && saved.completedAt !== null
        : saved.completeScanStartedAt !== null,
  }
  return {
    state,
    statuses: statuses.parse(JSON.parse(saved.statusesJson)),
    coveredFrom: saved.completeScanStartedAt ?? 0,
  }
}

type Paged = { page: number; pageSize: number }

// One numbered page of the scope's saved content that the condition selects, and the count of all.
function readContentPage(
  database: Database,
  { where, order, page, pageSize }: Paged & { where: SQL | undefined; order: SQL[] },
) {
  const rows = database
    .select({ content: ticketContent })
    .from(ticketContent)
    .innerJoin(ticketTable, eq(ticketTable.argoId, ticketContent.ticketId))
    .where(where)
    .orderBy(...order)
    .limit(pageSize)
    .offset(page * pageSize)
    .all()
  const [total] = database
    .select({ value: count() })
    .from(ticketContent)
    .innerJoin(ticketTable, eq(ticketTable.argoId, ticketContent.ticketId))
    .where(where)
    .all()
  return { rows: rows.map(({ content }) => content), total: total?.value ?? 0 }
}

// A Ticket the provider confirmed deleted stays in SQLite and shows nowhere.
const notDeleted = isNull(ticketContent.deletedAt)

const inScope = ({ provider, scope }: TicketScopeTarget) =>
  and(eq(ticketTable.provider, provider), eq(ticketTable.scope, scope))

type Listing = {
  sync: ReturnType<typeof readSync>
  listed: SQL | undefined
  order: AnyColumn
}

// One numbered page of a listing, with the total the listing holds.
function readListing(
  database: Database,
  request: TicketScopeTarget & Paged,
  { sync, listed, order }: Listing,
): ActiveRead {
  const { rows, total } = readContentPage(database, {
    ...request,
    where: listed,
    order: [asc(order), asc(ticketContent.key)],
  })
  return {
    tickets: rows.map(ticketFrom),
    statuses: sync.statuses,
    total,
    sync: sync.state,
  }
}

export function readActiveTickets(
  database: Database,
  request: TicketScopeTarget & Paged,
): ActiveRead {
  const sync = readSync(database, request)
  const listed = and(
    inScope(request),
    isNotNull(ticketContent.listedAt),
    gte(ticketContent.listedAt, sync.coveredFrom),
    notDeleted,
  )
  return readListing(database, request, { sync, listed, order: ticketContent.position })
}

// One numbered page of the Closed Tickets the Closed pages saved, in the provider's order.
export function readClosedTickets(
  database: Database,
  request: TicketScopeTarget & Paged,
): ActiveRead {
  const sync = readSync(database, request, 'closed')
  const listed = and(inScope(request), isNotNull(ticketContent.closedPosition), notDeleted)
  return readListing(database, request, { sync, listed, order: ticketContent.closedPosition })
}

// A saved Ticket of the scope named by its Argo UUID, its native ID or its key.
export function readSavedTicket(
  database: Database,
  { provider, scope, reference }: TicketScopeTarget & { reference: string },
): { saved: SavedTicket | null; statuses: TicketStatus[] } {
  const row = database
    .select({ argoId: ticketTable.argoId, nativeId: ticketTable.nativeId, content: ticketContent })
    .from(ticketTable)
    .innerJoin(ticketContent, eq(ticketContent.ticketId, ticketTable.argoId))
    .where(
      and(
        eq(ticketTable.provider, provider),
        eq(ticketTable.scope, scope),
        notDeleted,
        or(
          eq(ticketTable.argoId, reference),
          eq(ticketTable.nativeId, reference),
          eq(ticketContent.key, reference),
        ),
      ),
    )
    // An Argo UUID names one Ticket outright; a native ID outranks a key another row may share.
    .orderBy(
      sql`CASE WHEN ${ticketTable.argoId} = ${reference} THEN 0 WHEN ${ticketTable.nativeId} = ${reference} THEN 1 ELSE 2 END`,
    )
    .get()
  const { statuses } = readSync(database, { provider, scope })
  if (row === undefined) return { saved: null, statuses }
  const { argoId, nativeId, content } = row
  return { saved: { argoId, nativeId, ticket: ticketFrom(content) }, statuses }
}

type SearchRead = {
  tickets: Ticket[]
  statuses: TicketStatus[]
  total: number
  search: TicketSearchState
}

// A query as a LIKE pattern that matches it literally.
const containing = (query: string) => `%${query.replace(/[\\%_]/g, '\\$&')}%`

// The Tickets saved for a query, open or closed: those the provider returned for it, then those
// whose key, title or body hold it. The saved facts answer alone, whatever the provider has said.
export function readSearchedTickets(
  database: Database,
  request: TicketScopeTarget & Paged & { query: string },
): SearchRead {
  const { provider, scope, query } = request
  const pattern = containing(query)
  const linkPosition = sql<
    number | null
  >`(SELECT ${ticketSearchTicketLink.position} FROM ${ticketSearchTicketLink} WHERE ${and(
    eq(ticketSearchTicketLink.ticketId, ticketTable.argoId),
    eq(ticketSearchTicketLink.provider, provider),
    eq(ticketSearchTicketLink.scope, scope),
    eq(ticketSearchTicketLink.query, query),
  )})`
  const matching = and(
    eq(ticketTable.provider, provider),
    eq(ticketTable.scope, scope),
    notDeleted,
    or(
      sql`${linkPosition} IS NOT NULL`,
      sql`${ticketContent.key} LIKE ${pattern} ESCAPE '\\'`,
      sql`${ticketContent.title} LIKE ${pattern} ESCAPE '\\'`,
      sql`${ticketContent.body} LIKE ${pattern} ESCAPE '\\'`,
    ),
  )
  const { rows, total } = readContentPage(database, {
    ...request,
    where: matching,
    order: [
      sql`${linkPosition} IS NULL`,
      sql`${linkPosition}`,
      sql`${ticketContent.listedAt} IS NULL`,
      asc(ticketContent.position),
      asc(ticketContent.key),
    ],
  })
  return {
    tickets: rows.map(ticketFrom),
    statuses: readSync(database, request).statuses,
    total,
    search: readSearch(database, request),
  }
}

function readSearch(database: Database, target: TicketScopeTarget & { query: string }) {
  const row = database.select().from(ticketSearch).where(matchingSearch(target)).get()
  if (row === undefined) return IDLE_SEARCH
  const { phase, failure, completedAt } = ticketSearchSelectSchema.parse(row)
  return { phase, failure, completedAt }
}

// The Ticket screen's reads from SQLite alone: active means listed by the latest complete scan or later.
import { and, asc, count, eq, gte, isNotNull, or } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { ticketTable } from '@/database/ticket/schema'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import { ticketContent } from '@/database/ticket-content/schema'
import { ticketContentSelectSchema } from '@/database/ticket-content/validation'
import { ticketSync } from '@/database/ticket-sync/schema'
import { type TicketSyncState, ticketSyncSelectSchema } from '@/database/ticket-sync/validation'
import type { Ticket, TicketStatus } from '@/domains/tickets/contract/contract'
import { ticket, ticketStatus } from '@/domains/tickets/contract/ticket'
import { matchingScan } from '../sync/ticket-sync-records'

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

function readSync(database: Database, { provider, scope }: TicketScopeTarget) {
  const row = database
    .select()
    .from(ticketSync)
    .where(matchingScan({ provider, scope, kind: 'active' }))
    .get()
  if (row === undefined) return { state: IDLE, statuses: [], coveredFrom: 0 }
  const saved = ticketSyncSelectSchema.parse(row)
  const state: TicketSyncState = {
    phase: saved.phase,
    // Kept through a retry's scan, so the screen does not drop the failure while it retries.
    failure: saved.failure,
    completedAt: saved.completedAt,
    complete: saved.completeScanStartedAt !== null,
  }
  return {
    state,
    statuses: statuses.parse(JSON.parse(saved.statusesJson)),
    coveredFrom: saved.completeScanStartedAt ?? 0,
  }
}

export function readActiveTickets(
  database: Database,
  request: TicketScopeTarget & { page: number; pageSize: number },
): ActiveRead {
  const sync = readSync(database, request)
  const listed = and(
    eq(ticketTable.provider, request.provider),
    eq(ticketTable.scope, request.scope),
    isNotNull(ticketContent.listedAt),
    gte(ticketContent.listedAt, sync.coveredFrom),
  )
  const rows = database
    .select({ content: ticketContent })
    .from(ticketContent)
    .innerJoin(ticketTable, eq(ticketTable.argoId, ticketContent.ticketId))
    .where(listed)
    .orderBy(asc(ticketContent.position), asc(ticketContent.key))
    .limit(request.pageSize)
    .offset(request.page * request.pageSize)
    .all()
  const [total] = database
    .select({ value: count() })
    .from(ticketContent)
    .innerJoin(ticketTable, eq(ticketTable.argoId, ticketContent.ticketId))
    .where(listed)
    .all()
  return {
    tickets: rows.map(({ content }) => ticketFrom(content)),
    statuses: sync.statuses,
    total: total?.value ?? 0,
    sync: sync.state,
  }
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
        or(
          eq(ticketTable.argoId, reference),
          eq(ticketTable.nativeId, reference),
          eq(ticketContent.key, reference),
        ),
      ),
    )
    .get()
  const { statuses } = readSync(database, { provider, scope })
  if (row === undefined) return { saved: null, statuses }
  const { argoId, nativeId, content } = row
  return { saved: { argoId, nativeId, ticket: ticketFrom(content) }, statuses }
}

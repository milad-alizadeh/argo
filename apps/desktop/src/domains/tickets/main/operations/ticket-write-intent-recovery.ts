// After a restart, each write intent an earlier process left pending or uncertain is read by its
// Ticket's native ID: only a definite provider answer settles it, and nothing sends the write again.
import { eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { ticketTable } from '@/database/ticket/schema'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import { ticketWriteIntent } from '@/database/ticket-write-intent/schema'
import type { TicketConnection } from '@/domains/connections/main'
import { saveOmittedTicket, saveReadTicket } from '../database/ticket-upsert'
import { outcomeOf, type TicketRead } from '../sync/ticket-omitted'
import { settleIntent } from './ticket-write-intents'

// The Account a scope's Ticket writes go through, or null when no Connection names one now.
export type AccountForScope = (target: TicketScopeTarget) => string | null

const scopeKey = ({ provider, scope }: TicketScopeTarget) => `${provider}:${scope}`

// The first Connection naming a scope decides its Account; every Project on that scope shares one
// Ticket identity, so any of them answers for the write left behind.
export function accountForScopeFrom(connections: readonly TicketConnection[]): AccountForScope {
  const byScope = new Map(
    connections.map((connection) => [scopeKey(connection), connection.accountId]),
  )
  return (target) => byScope.get(scopeKey(target)) ?? null
}

type UncertainIntent = TicketScopeTarget & {
  intentId: string
  nativeId: string
}

function uncertainIntents(database: Database): UncertainIntent[] {
  return database
    .select({
      intentId: ticketWriteIntent.intentId,
      provider: ticketTable.provider,
      scope: ticketTable.scope,
      nativeId: ticketTable.nativeId,
    })
    .from(ticketWriteIntent)
    .innerJoin(ticketTable, eq(ticketTable.argoId, ticketWriteIntent.ticketId))
    .where(eq(ticketWriteIntent.phase, 'uncertain'))
    .all()
}

export type ReconcileDependencies = {
  database: Database
  readTicket: (
    request: TicketScopeTarget & { accountId: string },
    id: string,
  ) => Promise<TicketRead>
  accountForScope: AccountForScope
  changed: (target: TicketScopeTarget) => void
}

// Settles every write intent left uncertain, one at a time and each on its own commit, so a
// failure partway through leaves the rest to the next reconciliation.
export async function reconcileTicketWriteIntents({
  database,
  readTicket,
  accountForScope,
  changed,
}: ReconcileDependencies): Promise<void> {
  for (const intent of uncertainIntents(database)) {
    const { provider, scope, nativeId } = intent
    const accountId = accountForScope({ provider, scope })
    if (accountId === null) continue
    const readAt = Date.now()
    const read = await readTicket({ provider, scope, accountId }, nativeId).catch(
      (): TicketRead => ({ ok: false, failure: 'connection-lost' }),
    )
    const outcome = outcomeOf(read)
    if (!outcome) continue
    if (outcome.kind === 'read')
      saveReadTicket(database, { provider, scope, readAt }, outcome.ticket)
    else saveOmittedTicket(database, { provider, scope, nativeId, readAt }, outcome)
    settleIntent(database, { intentId: intent.intentId, phase: 'committed' })
    changed({ provider, scope })
  }
}

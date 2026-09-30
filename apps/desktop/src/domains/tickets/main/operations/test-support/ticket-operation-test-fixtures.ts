// Shared fixtures for the Ticket operation and write-intent recovery tests: one seeded scope, one
// saved Ticket shape, and the status read both suites assert against.
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { onTestFinished } from 'vitest'
import { type Database, openDatabase } from '@/database/database'
import { ticketContent } from '@/database/ticket-content/schema'
import type { Ticket, TicketStatus } from '@/domains/tickets/api/ticket'
import { saveListedTickets } from '../../database/ticket-upsert'

const OPEN: TicketStatus = { id: 'open', name: 'Open', category: 'unstarted' }
export const DONE: TicketStatus = { id: 'done', name: 'Done', category: 'completed' }
export const SCOPE = { provider: 'github', scope: 'octocat/hello-world' } as const

export const ticket = (key: string): Ticket => ({
  key,
  url: null,
  title: `Ticket ${key}`,
  body: null,
  state: 'open',
  status: OPEN,
  priority: null,
  createdAt: '2026-09-29T00:00:00Z',
  labels: [],
  type: null,
  children: [],
  blockedBy: null,
})

// A fresh SQLite database, seeded with one listed Ticket per key, cleaned up after the test.
export async function seededDatabase(keys: readonly string[] = ['#1']): Promise<Database> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-ticket-operations-'))
  onTestFinished(() => rm(directory, { force: true, recursive: true }))
  const database = openDatabase(directory)
  onTestFinished(() => database.$client.close())
  saveListedTickets(
    database,
    { ...SCOPE, scanStartedAt: 1, offset: 0, readAt: Date.now() },
    keys.map(ticket),
  )
  return database
}

export const savedStatus = (database: Database, key: string) => {
  const row = database
    .select({ statusJson: ticketContent.statusJson })
    .from(ticketContent)
    .where(eq(ticketContent.key, key))
    .get()
  return row === undefined ? undefined : (JSON.parse(row.statusJson) as TicketStatus)
}

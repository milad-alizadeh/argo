// The one user-asserted `Session → Ticket` link (ADR-0017, CONTEXT.md L1 · Session → Ticket): a
// fallback for a Session with no branch, hence no Delivery, hence no derivable link. Per-machine
// owned state, never committed. A Session links to at most one Ticket, so the document is keyed
// by sessionId; content (title, state) is a cached echo, never authoritative (CONTEXT.md L1 ·
// Ticket), read fresh from the provider whenever a caller needs more than the cached fields.

import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { DurableDatabase } from '@/database/durable-database'
import { sessionTicketLink } from '@/database/session-ticket-link/schema'
import { sessionTicketLinkSelectSchema } from '@/database/session-ticket-link/validation'
import { ticketKey } from '@/domains/tickets/contract/ticket'
import {
  createWriteQueue,
  readDocument,
  writeDocument,
} from '@/platform/main/storage/portable-file'
import { identifierSchema } from '@/shared/validation'

const linkedTicketSchema = z.strictObject({
  projectId: identifierSchema,
  key: ticketKey,
  title: z.string(),
  state: z.enum(['open', 'closed']),
  createdAt: z.iso.datetime(),
})
export type LinkedTicket = z.infer<typeof linkedTicketSchema>

const linksDocumentSchema = z.record(z.string(), linkedTicketSchema)

export type SessionTicketLinkStore = {
  linkFor: (sessionId: string) => Promise<LinkedTicket | null>
  // Every sessionId linked to one Ticket, most recently linked first (CONTEXT.md L1 · claim lease
  // reads this same ordering; this ticket does not build the lease itself).
  linkedSessions: (projectId: string, key: string) => Promise<string[]>
  connect: (
    sessionId: string,
    ticket: Omit<LinkedTicket, 'createdAt'>,
    createdAt: string,
  ) => Promise<void>
  disconnect: (sessionId: string) => Promise<void>
  close: () => void
}

const storedLinkSchema = sessionTicketLinkSelectSchema
  .pick({
    projectId: true,
    ticketKey: true,
    title: true,
    state: true,
    createdAt: true,
  })
  .extend({
    state: z.enum(['open', 'closed']),
    createdAt: z.iso.datetime(),
  })

function linkedTicket(record: unknown): LinkedTicket | null {
  if (record === null || record === undefined) return null
  const parsed = storedLinkSchema.parse(record)
  return {
    projectId: parsed.projectId,
    key: parsed.ticketKey,
    title: parsed.title,
    state: parsed.state,
    createdAt: parsed.createdAt,
  }
}

async function readLinks(path: string): Promise<Record<string, LinkedTicket>> {
  const read = await readDocument(path)
  if (!read.ok) return {}
  const parsed = linksDocumentSchema.safeParse(read.document)
  return parsed.success ? parsed.data : {}
}

// A caller that does not care about the Session → Ticket link at all — a single-Harness reader built
// for a fixture or a test of unrelated behaviour — gets this rather than a required file path.
export function createInMemorySessionTicketLinkStore(): SessionTicketLinkStore {
  const links = new Map<string, LinkedTicket>()
  return {
    linkFor: async (sessionId) => links.get(sessionId) ?? null,
    linkedSessions: async (projectId, key) =>
      [...links.entries()]
        .filter(([, link]) => link.projectId === projectId && link.key === key)
        .sort(([, a], [, b]) => b.createdAt.localeCompare(a.createdAt))
        .map(([sessionId]) => sessionId),
    connect: async (sessionId, ticket, createdAt) => {
      links.set(sessionId, { ...ticket, createdAt })
    },
    disconnect: async (sessionId) => {
      links.delete(sessionId)
    },
    close: () => {},
  }
}

export function createSessionTicketLinkStore(path: string): SessionTicketLinkStore {
  const enqueue = createWriteQueue()
  return {
    linkFor: async (sessionId) => (await readLinks(path))[sessionId] ?? null,
    linkedSessions: async (projectId, key) =>
      Object.entries(await readLinks(path))
        .filter(([, link]) => link.projectId === projectId && link.key === key)
        .sort(([, a], [, b]) => b.createdAt.localeCompare(a.createdAt))
        .map(([sessionId]) => sessionId),
    connect: (sessionId, ticket, createdAt) =>
      enqueue(async () => {
        const links = await readLinks(path)
        await writeDocument(path, { ...links, [sessionId]: { ...ticket, createdAt } })
      }),
    disconnect: (sessionId) =>
      enqueue(async () => {
        const { [sessionId]: _removed, ...rest } = await readLinks(path)
        await writeDocument(path, rest)
      }),
    close: () => {},
  }
}

export function createSessionTicketLinkStoreFromDatabase(
  database: DurableDatabase,
  afterWrite: () => Promise<void> = async () => {},
): SessionTicketLinkStore {
  return {
    linkFor: async (sessionId) =>
      linkedTicket(
        database
          .select({
            projectId: sessionTicketLink.projectId,
            ticketKey: sessionTicketLink.ticketKey,
            title: sessionTicketLink.title,
            state: sessionTicketLink.state,
            createdAt: sessionTicketLink.createdAt,
          })
          .from(sessionTicketLink)
          .where(eq(sessionTicketLink.sessionId, sessionId))
          .get(),
      ),
    linkedSessions: async (projectId, key) =>
      database
        .select({ sessionId: sessionTicketLink.sessionId })
        .from(sessionTicketLink)
        .where(
          and(eq(sessionTicketLink.projectId, projectId), eq(sessionTicketLink.ticketKey, key)),
        )
        .orderBy(desc(sessionTicketLink.createdAt))
        .all()
        .map((row) => row.sessionId),
    connect: async (sessionId, ticket, createdAt) => {
      const link = {
        sessionId,
        projectId: ticket.projectId,
        ticketKey: ticket.key,
        title: ticket.title,
        state: ticket.state,
        createdAt,
      }
      database
        .insert(sessionTicketLink)
        .values(link)
        .onConflictDoUpdate({ target: sessionTicketLink.sessionId, set: link })
        .run()
      await afterWrite()
    },
    disconnect: async (sessionId) => {
      database.delete(sessionTicketLink).where(eq(sessionTicketLink.sessionId, sessionId)).run()
      await afterWrite()
    },
    // The shared database's lifecycle belongs to whoever opened it (`openDurableStores`), not to
    // this store: closing `$client` here raced its other close call and threw "database is not
    // open" during app quit (#2607).
    close: () => {},
  }
}

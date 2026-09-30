// The one user-asserted `Session → Ticket` link (ADR-0017, CONTEXT.md L1 · Session → Ticket): a
// fallback for a Session with no branch, hence no Delivery, hence no derivable link. Per-machine
// owned state, never committed. A Session links to at most one Ticket, so the document is keyed
// by sessionId. The link holds only the Ticket's key; its content comes from the saved Ticket.

import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTicketLink } from '@/database/session-ticket-link/schema'
import { sessionTicketLinkSelectSchema } from '@/database/session-ticket-link/validation'
import { ticketKey } from '@/domains/tickets/api/ticket'
import {
  createWriteQueue,
  readDocument,
  writeDocument,
} from '@/platform/main/storage/portable-file'
import { identifierSchema } from '@/shared/validation'

const linkedTicketSchema = z.strictObject({
  projectId: identifierSchema,
  key: ticketKey,
  createdAt: z.iso.datetime(),
})
type LinkedTicket = z.infer<typeof linkedTicketSchema>

const linksDocumentSchema = z.record(z.string(), linkedTicketSchema)

export type SessionTicketLinkStore = {
  linkFor: (sessionId: string) => Promise<LinkedTicket | null>
  connect: (
    sessionId: string,
    ticket: Omit<LinkedTicket, 'createdAt'>,
    createdAt: string,
  ) => Promise<void>
  disconnect: (sessionId: string) => Promise<void>
  close: () => void
}

const storedLinkSchema = sessionTicketLinkSelectSchema
  .pick({ projectId: true, ticketKey: true, createdAt: true })
  .extend({ createdAt: z.iso.datetime() })

function linkedTicket(record: unknown): LinkedTicket | null {
  if (record === null || record === undefined) return null
  const parsed = storedLinkSchema.parse(record)
  return {
    projectId: parsed.projectId,
    key: parsed.ticketKey,
    createdAt: parsed.createdAt,
  }
}

async function readLinks(path: string): Promise<Record<string, LinkedTicket>> {
  const read = await readDocument(path)
  if (!read.ok) return {}
  const parsed = linksDocumentSchema.safeParse(read.document)
  return parsed.success ? parsed.data : {}
}

export function createSessionTicketLinkStore(path: string): SessionTicketLinkStore {
  const enqueue = createWriteQueue()
  return {
    linkFor: async (sessionId) => (await readLinks(path))[sessionId] ?? null,
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
  database: Database,
  afterWrite: () => Promise<void> = async () => {},
): SessionTicketLinkStore {
  return {
    linkFor: async (sessionId) =>
      linkedTicket(
        database
          .select({
            projectId: sessionTicketLink.projectId,
            ticketKey: sessionTicketLink.ticketKey,
            createdAt: sessionTicketLink.createdAt,
          })
          .from(sessionTicketLink)
          .where(eq(sessionTicketLink.sessionId, sessionId))
          .get(),
      ),
    connect: async (sessionId, ticket, createdAt) => {
      const link = {
        sessionId,
        projectId: ticket.projectId,
        ticketKey: ticket.key,
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

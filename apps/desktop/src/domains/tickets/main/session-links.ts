// The one user-asserted `Session → Ticket` link (ADR-0017, CONTEXT.md L1 · Session → Ticket): a
// fallback for a Session with no branch, hence no Delivery, hence no derivable link. Per-machine
// owned state, never committed. A Session links to at most one Ticket, so the document is keyed
// by sessionId; content (title, state) is a cached echo, never authoritative (CONTEXT.md L1 ·
// Ticket), read fresh from the provider whenever a caller needs more than the cached fields.
import { z } from 'zod'
import { identifierSchema } from '../../../boundary'
import { createWriteQueue, readDocument, writeDocument } from '../../../core/storage/portable-file'
import { ticketKey } from '../contract/ticket'

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
}

async function readLinks(path: string): Promise<Record<string, LinkedTicket>> {
  const read = await readDocument(path)
  if (!read.ok) return {}
  const parsed = linksDocumentSchema.safeParse(read.document)
  return parsed.success ? parsed.data : {}
}

// A caller that does not care about the Session → Ticket link at all — a single-CLI reader built
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
  }
}

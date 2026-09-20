// The one user-asserted `Session → Ticket` link (ADR-0017, CONTEXT.md L1 · Session → Ticket): a
// fallback for a Session with no branch, hence no Delivery, hence no derivable link. Per-machine
// owned state, never committed. A Session links to at most one Ticket, so the document is keyed
// by sessionId; content (title, state) is a cached echo, never authoritative (CONTEXT.md L1 ·
// Ticket), read fresh from the provider whenever a caller needs more than the cached fields.
import { z } from 'zod'
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

type SQLiteStatement = {
  all: (...values: string[]) => unknown[]
  get: (...values: string[]) => unknown
  run: (...values: string[]) => unknown
}

type SQLiteDatabase = {
  exec: (source: string) => void
  prepare: (source: string) => SQLiteStatement
  close: () => void
}

const LINK_SCHEMA = `
CREATE TABLE IF NOT EXISTS session_ticket_link (
  session_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  ticket_key TEXT NOT NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open', 'closed')),
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS session_ticket_link_ticket
  ON session_ticket_link (project_id, ticket_key, created_at DESC);
`

const storedLinkSchema = z.strictObject({
  project_id: identifierSchema,
  ticket_key: ticketKey,
  title: z.string(),
  state: z.enum(['open', 'closed']),
  created_at: z.iso.datetime(),
})

function linkedTicket(record: unknown): LinkedTicket | null {
  if (record === null || record === undefined) return null
  const parsed = storedLinkSchema.parse(record)
  return {
    projectId: parsed.project_id,
    key: parsed.ticket_key,
    title: parsed.title,
    state: parsed.state,
    createdAt: parsed.created_at,
  }
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

export function createSQLiteSessionTicketLinkStore(
  database: SQLiteDatabase,
  afterWrite: () => Promise<void> = async () => {},
): SessionTicketLinkStore {
  database.exec(LINK_SCHEMA)
  const linkFor = database.prepare(
    'SELECT project_id, ticket_key, title, state, created_at FROM session_ticket_link WHERE session_id = ?',
  )
  const linkedSessions = database.prepare(
    'SELECT session_id FROM session_ticket_link WHERE project_id = ? AND ticket_key = ? ORDER BY created_at DESC',
  )
  const connect = database.prepare(
    'INSERT INTO session_ticket_link (session_id, project_id, ticket_key, title, state, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET project_id = excluded.project_id, ticket_key = excluded.ticket_key, title = excluded.title, state = excluded.state, created_at = excluded.created_at',
  )
  const disconnect = database.prepare('DELETE FROM session_ticket_link WHERE session_id = ?')

  return {
    linkFor: async (sessionId) => linkedTicket(linkFor.get(sessionId)),
    linkedSessions: async (projectId, key) =>
      linkedSessions
        .all(projectId, key)
        .map((row) => z.strictObject({ session_id: identifierSchema }).parse(row).session_id),
    connect: async (sessionId, ticket, createdAt) => {
      connect.run(sessionId, ticket.projectId, ticket.key, ticket.title, ticket.state, createdAt)
      await afterWrite()
    },
    disconnect: async (sessionId) => {
      disconnect.run(sessionId)
      await afterWrite()
    },
    close: () => database.close(),
  }
}

// The Connection store: which repository each Project reads its Tickets from, and through which
// Account (CONTEXT.md L1 · Connection). Its own file beside `projects.json`, because a registration's
// identity and its validated links are separate destination files
// (docs/portable-integration-contracts.md).
import { isIdentifier, isRecord } from '../../boundary'
import { otherFields, readDocument, writeDocument } from '../storage/portable-file'

export type TicketConnection = {
  projectId: string
  port: 'ticket'
  accountId: string
  scope: string
  [key: string]: unknown
}

// Records for a port this build does not fill stay as they were written: another client owns them.
export type ConnectionDocument = {
  connections: TicketConnection[]
  others: unknown[]
  other: Record<string, unknown>
}

export type ConnectionRead =
  | { ok: true; document: ConnectionDocument }
  | { ok: false; reason: 'unreadable' | 'invalid' }

const OWNED = ['version', 'connections']

function isTicketConnection(value: Record<string, unknown>): value is TicketConnection {
  return isIdentifier(value.projectId) && isIdentifier(value.accountId) && isIdentifier(value.scope)
}

function parse(document: unknown): ConnectionDocument {
  if (!isRecord(document) || document.version !== 1 || !Array.isArray(document.connections)) {
    throw new Error('Invalid Connection store')
  }
  const connections: TicketConnection[] = []
  const others: unknown[] = []
  for (const entry of document.connections) {
    if (!isRecord(entry) || entry.port !== 'ticket') {
      others.push(entry)
      continue
    }
    // One Ticket source per Project: a second is ambiguous, and guessing would read the wrong one.
    if (
      !isTicketConnection(entry) ||
      connections.some((known) => known.projectId === entry.projectId)
    ) {
      throw new Error('Invalid Connection store')
    }
    connections.push(entry)
  }
  return { connections, others, other: otherFields(document, OWNED) }
}

export async function readConnections(connectionsPath: string): Promise<ConnectionRead> {
  const read = await readDocument(connectionsPath)
  if (!read.ok) {
    const empty = { connections: [], others: [], other: {} }
    return read.reason === 'missing'
      ? { ok: true, document: empty }
      : { ok: false, reason: read.reason }
  }
  try {
    return { ok: true, document: parse(read.document) }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

export function writeConnections(
  connectionsPath: string,
  document: ConnectionDocument,
): Promise<boolean> {
  const { connections, others, other } = document
  return writeDocument(connectionsPath, {
    ...other,
    version: 1,
    connections: [...others, ...connections],
  })
}

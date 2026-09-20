// The durable Connection port. Accounts and Tickets use this seam, never each other's stores.
import type { Provider } from '@/domains/accounts/contract/contract'
import { providerOf } from '@/domains/accounts/contract/provider'
import { otherFields, readDocument, writeDocument } from '@/platform/main/storage/portable-file'
import { isIdentifier, isRecord } from '@/shared/validation'

export type TicketConnection = {
  projectId: string
  port: 'ticket'
  provider: Provider
  accountId: string
  scope: string
  label: string
  [key: string]: unknown
}

export type ConnectionDocument = {
  connections: TicketConnection[]
  others: unknown[]
  other: Record<string, unknown>
}

export type ConnectionRead =
  | { ok: true; document: ConnectionDocument }
  | { ok: false; reason: 'unreadable' | 'invalid' }

export type ConnectionPort = {
  read: () => Promise<ConnectionRead>
  replaceTicket: (projectId: string, next: TicketConnection | null) => Promise<boolean | ConnectionRead>
}

const OWNED = ['version', 'connections']

function ticketConnection(value: Record<string, unknown>): TicketConnection | null {
  const { projectId, accountId, scope } = value
  if (!isIdentifier(projectId) || !isIdentifier(accountId) || !isIdentifier(scope)) return null
  const provider = providerOf(accountId)
  if (!provider) return null
  const label = typeof value.label === 'string' && value.label !== '' ? value.label : scope
  return { ...value, projectId, port: 'ticket', provider, accountId, scope, label }
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
    const connection = ticketConnection(entry)
    if (!connection || connections.some((known) => known.projectId === connection.projectId)) {
      throw new Error('Invalid Connection store')
    }
    connections.push(connection)
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
  const written = connections.map(({ provider: _provider, ...connection }) => connection)
  return writeDocument(connectionsPath, {
    ...other,
    version: 1,
    connections: [...others, ...written],
  })
}

// The durable store belongs to Connection. Product domains request one replacement; they never
// coordinate a read/filter/write sequence themselves.
export function createConnectionPort(options: {
  path: string
  exclusive: <T>(work: () => Promise<T>) => Promise<T>
}): ConnectionPort {
  return {
    read: () => readConnections(options.path),
    replaceTicket: (projectId, next) =>
      options.exclusive(async () => {
        const read = await readConnections(options.path)
        if (!read.ok) return read
        const connections = read.document.connections.filter((entry) => entry.projectId !== projectId)
        return writeConnections(options.path, {
          ...read.document,
          connections: next ? [...connections, next] : connections,
        })
      }),
  }
}

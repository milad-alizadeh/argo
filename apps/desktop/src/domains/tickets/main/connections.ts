// The Connection store: which repository or team each Project reads its Tickets from, and through which
// Account (CONTEXT.md L1 · Connection). Its own file beside `projects.json`, because a registration's
// identity and its validated links are separate destination files
// (docs/portable-integration-contracts.md).
import { isIdentifier, isRecord } from '../../../boundary'
import { otherFields, readDocument, writeDocument } from '../../../core/storage/portable-file'
import type { Provider } from '../../accounts/contract/contract'
import { providerOf } from '../../accounts/main/registry'

// `scope` is the provider's id for the source, and `label` its name when it was connected: a
// GitHub repository is both at once, a Linear team an id and a name.
export type TicketConnection = {
  projectId: string
  port: 'ticket'
  provider: Provider
  accountId: string
  scope: string
  label: string
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

// The provider is read from the Account ID, and a record from before labels names its scope.
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
    // One Ticket source per Project: a second is ambiguous, and guessing would read the wrong one.
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
  // The provider is read from the Account ID each time, so it is not written a second time.
  const written = connections.map(({ provider: _provider, ...connection }) => connection)
  return writeDocument(connectionsPath, {
    ...other,
    version: 1,
    connections: [...others, ...written],
  })
}

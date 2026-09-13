// The Binding store: which repository each Project reads its Tickets from, and through which
// Account (CONTEXT.md L1 · Binding). Its own file beside `projects.json`, because a registration's
// identity and its validated links are separate destination files
// (docs/portable-integration-contracts.md).
import { isIdentifier, isRecord } from '../../boundary'
import { otherFields, readDocument, writeDocument } from '../storage/portable-file'

export type TicketBinding = {
  projectId: string
  port: 'ticket'
  accountId: string
  scope: string
  [key: string]: unknown
}

// Records for a port this build does not fill stay as they were written: another client owns them.
export type BindingDocument = {
  bindings: TicketBinding[]
  others: unknown[]
  other: Record<string, unknown>
}

export type BindingRead =
  | { ok: true; document: BindingDocument }
  | { ok: false; reason: 'unreadable' | 'invalid' }

const OWNED = ['version', 'bindings']

function isTicketBinding(value: Record<string, unknown>): value is TicketBinding {
  return isIdentifier(value.projectId) && isIdentifier(value.accountId) && isIdentifier(value.scope)
}

function parse(document: unknown): BindingDocument {
  if (!isRecord(document) || document.version !== 1 || !Array.isArray(document.bindings)) {
    throw new Error('Invalid Binding store')
  }
  const bindings: TicketBinding[] = []
  const others: unknown[] = []
  for (const entry of document.bindings) {
    if (!isRecord(entry) || entry.port !== 'ticket') {
      others.push(entry)
      continue
    }
    // One Ticket source per Project: a second is ambiguous, and guessing would read the wrong one.
    if (!isTicketBinding(entry) || bindings.some((known) => known.projectId === entry.projectId)) {
      throw new Error('Invalid Binding store')
    }
    bindings.push(entry)
  }
  return { bindings, others, other: otherFields(document, OWNED) }
}

export async function readBindings(bindingsPath: string): Promise<BindingRead> {
  const read = await readDocument(bindingsPath)
  if (!read.ok) {
    const empty = { bindings: [], others: [], other: {} }
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

export function writeBindings(bindingsPath: string, document: BindingDocument): Promise<boolean> {
  const { bindings, others, other } = document
  return writeDocument(bindingsPath, { ...other, version: 1, bindings: [...others, ...bindings] })
}

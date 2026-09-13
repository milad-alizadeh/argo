// The secret-free Account records, one per provider identity, under `userData` (#1763). The key is
// the provider's own stable id and never the login, which renames (ADR-0018).
import { isIdentifier, isRecord } from '../../boundary'
import { otherFields, readDocument, writeDocument } from '../storage/portable-file'
import type { AccountState } from './contract'

// What is written down about an Account. An unreadable grant is found on reading, never stored.
type StoredState = Exclude<AccountState, 'unreadable'>

export type AccountRecord = {
  id: string
  provider: 'github'
  providerAccountId: string
  login: string
  scopes: string[]
  state: StoredState
  [key: string]: unknown
}

export type AccountRegistry = {
  accounts: AccountRecord[]
  noticeDismissed: boolean
  other: Record<string, unknown>
}

export type AccountRegistryRead =
  | { ok: true; registry: AccountRegistry }
  | { ok: false; reason: 'unreadable' | 'invalid' }

const EMPTY: AccountRegistry = { accounts: [], noticeDismissed: false, other: {} }
const OWNED = ['version', 'accounts', 'noticeDismissed']

export const accountId = (providerAccountId: string) => `github:${providerAccountId}`

function parseAccount(value: unknown, seen: Set<string>): AccountRecord {
  if (
    !isRecord(value) ||
    value.provider !== 'github' ||
    !isIdentifier(value.providerAccountId) ||
    value.id !== accountId(value.providerAccountId) ||
    seen.has(value.id) ||
    !isIdentifier(value.login) ||
    !Array.isArray(value.scopes) ||
    !value.scopes.every((scope) => typeof scope === 'string')
  ) {
    throw new Error('Invalid Account registry')
  }
  seen.add(value.id)
  // An unknown state is read as connected: the next provider call is what decides it.
  const state = value.state === 'revoked' ? 'revoked' : 'connected'
  const { providerAccountId, login, scopes } = value
  return { ...value, id: value.id, provider: 'github', providerAccountId, login, scopes, state }
}

function parseRegistry(document: unknown): AccountRegistry {
  if (!isRecord(document) || document.version !== 1 || !Array.isArray(document.accounts)) {
    throw new Error('Invalid Account registry')
  }
  const seen = new Set<string>()
  return {
    accounts: document.accounts.map((account) => parseAccount(account, seen)),
    noticeDismissed: document.noticeDismissed === true,
    other: otherFields(document, OWNED),
  }
}

export async function readAccounts(registryPath: string): Promise<AccountRegistryRead> {
  const read = await readDocument(registryPath)
  if (!read.ok) {
    return read.reason === 'missing'
      ? { ok: true, registry: EMPTY }
      : { ok: false, reason: read.reason }
  }
  try {
    return { ok: true, registry: parseRegistry(read.document) }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

export function writeAccounts(registryPath: string, registry: AccountRegistry): Promise<boolean> {
  const { accounts, noticeDismissed, other } = registry
  return writeDocument(registryPath, { ...other, version: 1, accounts, noticeDismissed })
}

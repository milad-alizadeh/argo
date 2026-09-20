// The secret-free Account records, one per provider identity, under `userData` (#1763). The key is
// the provider's own stable id and never the login, which renames (ADR-0018).

import { type AccountState, displayName, type Provider } from '@/domains/accounts/contract/contract'
import { providerOf } from '@/domains/accounts/contract/provider'
import { otherFields, readDocument, writeDocument } from '@/platform/main/storage/portable-file'
import { isIdentifier, isRecord } from '@/shared/validation'

// What is written down about an Account. An unreadable grant is found on reading, never stored.
type StoredState = Exclude<AccountState, 'unreadable'>

export type AccountRecord = {
  id: string
  provider: Provider
  providerAccountId: string
  login: string
  // The Linear workspace the Account signed in to; null on GitHub.
  workspace: string | null
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

export const accountId = (provider: Provider, providerAccountId: string) =>
  `${provider}:${providerAccountId}`

const STORED_STATES = new Map<unknown, StoredState>([
  ['expired', 'expired'],
  ['revoked', 'revoked'],
])

function parseAccount(value: unknown, seen: Set<string>): AccountRecord {
  const provider = isRecord(value) && typeof value.id === 'string' ? providerOf(value.id) : null
  if (
    !isRecord(value) ||
    !provider ||
    value.provider !== provider ||
    !isIdentifier(value.providerAccountId) ||
    value.id !== accountId(provider, value.providerAccountId) ||
    seen.has(value.id) ||
    !displayName.safeParse(value.login).success ||
    !Array.isArray(value.scopes) ||
    !value.scopes.every((scope) => typeof scope === 'string')
  ) {
    throw new Error('Invalid Account registry')
  }
  seen.add(value.id)
  // An unknown state is read as connected: the next provider call is what decides it.
  const state = STORED_STATES.get(value.state) ?? 'connected'
  const { providerAccountId, scopes } = value
  const login = String(value.login)
  const workspace = typeof value.workspace === 'string' ? value.workspace : null
  return { ...value, id: value.id, provider, providerAccountId, login, workspace, scopes, state }
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

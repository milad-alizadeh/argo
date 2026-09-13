// Everything the main process holds to reach GitHub on an Account's behalf. Built once per window
// in `main.ts` and shared by the Account and Ticket bridges, so both write through one queue.
import type { GitHubEndpoints } from '../../providers/github/endpoints'
import { readRegistry, toSummary } from '../projects/registry'
import { createWriteQueue, portablePath } from '../storage/portable-file'
import type { AccountState } from './contract'
import { type Cipher, createGrantStore, type GrantStore } from './grants'
import { type AccountRecord, readAccounts, writeAccounts } from './registry'

export type AccountAccess = {
  endpoints: GitHubEndpoints
  grants: GrantStore
  paths: { accounts: string; bindings: string; projects: string }
  exclusive: <T>(work: () => Promise<T>) => Promise<T>
  // Opens a URL the main process already validated. Never a URL the renderer named.
  openExternal: (url: string) => Promise<void>
}

export function createAccountAccess(options: {
  userData: string
  endpoints: GitHubEndpoints
  cipher: Cipher
  openExternal: (url: string) => Promise<void>
}): AccountAccess {
  const { userData, endpoints, cipher, openExternal } = options
  return {
    endpoints,
    grants: createGrantStore(portablePath(userData, 'grants.json'), cipher),
    paths: {
      accounts: portablePath(userData, 'accounts.json'),
      bindings: portablePath(userData, 'bindings.json'),
      projects: portablePath(userData, 'projects.json'),
    },
    exclusive: createWriteQueue(),
    openExternal,
  }
}

// Project names by ID, for drawing a Binding. A registry that cannot be read names nothing.
export async function projectNames(access: AccountAccess): Promise<Map<string, string>> {
  const read = await readRegistry(access.paths.projects)
  const registrations = read.ok ? read.registry.projects : []
  return new Map(registrations.map((project) => [project.id, toSummary(project).name]))
}

export type TokenRead =
  | { ok: true; token: string; account: AccountRecord }
  | { ok: false; reason: 'storage' | 'missing-account' | 'account-revoked' | 'grant-unreadable' }

// The one way a provider call gets a token. A revoked Account is not called again until the
// person reconnects it: its grant is known to be refused.
export async function tokenFor(access: AccountAccess, accountId: string): Promise<TokenRead> {
  const registry = await readAccounts(access.paths.accounts)
  if (!registry.ok) return { ok: false, reason: 'storage' }
  const account = registry.registry.accounts.find((candidate) => candidate.id === accountId)
  if (!account) return { ok: false, reason: 'missing-account' }
  if (account.state === 'revoked') return { ok: false, reason: 'account-revoked' }
  const grant = await access.grants.read(accountId)
  if (!grant.ok) return { ok: false, reason: 'grant-unreadable' }
  return { ok: true, token: grant.grant.accessToken, account }
}

// What calling GitHub as this Account would meet, read afresh so the Account row and every Binding
// naming it agree.
export async function accountState(
  access: AccountAccess,
  account: AccountRecord,
): Promise<AccountState> {
  if (account.state === 'revoked') return 'revoked'
  return (await access.grants.read(account.id)).ok ? 'connected' : 'unreadable'
}

// GitHub refused `refusedToken`. The Account keeps its record, marked, so every Binding naming it
// can say why it stopped reading. A grant renewed while that request was in flight is not the one
// refused, and stays connected.
export function markRevoked(
  access: AccountAccess,
  accountId: string,
  refusedToken: string,
): Promise<boolean> {
  return access.exclusive(async () => {
    const current = await access.grants.read(accountId)
    if (current.ok && current.grant.accessToken !== refusedToken) return false
    const read = await readAccounts(access.paths.accounts)
    if (!read.ok) return false
    const accounts = read.registry.accounts.map((account) =>
      account.id === accountId ? { ...account, state: 'revoked' as const } : account,
    )
    return writeAccounts(access.paths.accounts, { ...read.registry, accounts })
  })
}

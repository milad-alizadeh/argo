// Everything the main process holds to reach a provider on an Account's behalf. Built once per
// window in `main.ts` and shared by the Account and Ticket bridges, so both write through one queue.

import type { AccountState } from '@/domains/accounts/contract/contract'
import { type Cipher, createGrantStore, type GrantStore } from '@/domains/accounts/main/grants'
import { type AccountRecord, readAccounts, writeAccounts } from '@/domains/accounts/main/registry'
import type { ProjectPort } from '@/domains/projects/main/port'
import { createWriteQueue, portablePath } from '@/platform/main/storage/portable-file'
import type { ProviderEndpoints } from '@/providers/endpoints'

export type AccountAccess = {
  endpoints: ProviderEndpoints
  grants: GrantStore
  paths: { accounts: string; connections: string }
  projects: ProjectPort | null
  exclusive: <T>(work: () => Promise<T>) => Promise<T>
  // Opens a URL the main process already validated. Never a URL the renderer named.
  openExternal: (url: string) => Promise<void>
}

// `accountData` is where the Account records and their grants sit, and `userData` is everything
// else this app owns. They are the same directory in a packaged app. A development app points
// `accountData` at one store shared by every worktree, so a sign-in is done once (#2304).
export function createAccountAccess(options: {
  userData: string
  accountData: string
  connectionData?: string
  endpoints: ProviderEndpoints
  cipher: Cipher
  openExternal: (url: string) => Promise<void>
  projects?: ProjectPort
}): AccountAccess {
  const { userData, accountData, connectionData, endpoints, cipher, openExternal, projects } =
    options
  return {
    endpoints,
    grants: createGrantStore(portablePath(accountData, 'grants.json'), cipher),
    paths: {
      accounts: portablePath(accountData, 'accounts.json'),
      connections: portablePath(connectionData ?? userData, 'connections.json'),
    },
    projects: projects ?? null,
    exclusive: createWriteQueue(),
    openExternal,
  }
}

// Project names by ID, for drawing a Connection. A registry that cannot be read names nothing.
export async function projectNames(access: AccountAccess): Promise<Map<string, string>> {
  try {
    return access.projects?.names() ?? new Map()
  } catch {
    return new Map()
  }
}

// What calling the provider as this Account would meet, read afresh so the Account row and every
// Connection naming it agree.
export async function accountState(
  access: AccountAccess,
  account: AccountRecord,
): Promise<AccountState> {
  if (account.state !== 'connected') return account.state
  return (await access.grants.read(account.id)).ok ? 'connected' : 'unreadable'
}

// Record why an Account stopped reading. Called inside the write queue only.
export async function writeState(
  access: AccountAccess,
  change: { accountId: string; state: 'expired' | 'revoked' },
): Promise<boolean> {
  const read = await readAccounts(access.paths.accounts)
  if (!read.ok) return false
  const accounts = read.registry.accounts.map((account) =>
    account.id === change.accountId ? { ...account, state: change.state } : account,
  )
  return writeAccounts(access.paths.accounts, { ...read.registry, accounts })
}

// The provider refused `refusedToken`. The Account keeps its record, marked, so every Connection
// naming it can say why it stopped reading. A grant renewed while that request was in flight is not
// the one refused, and stays connected.
export function markRevoked(
  access: AccountAccess,
  accountId: string,
  refusedToken: string,
): Promise<boolean> {
  return access.exclusive(async () => {
    const current = await access.grants.read(accountId)
    if (current.ok && current.grant.accessToken !== refusedToken) return false
    return writeState(access, { accountId, state: 'revoked' })
  })
}

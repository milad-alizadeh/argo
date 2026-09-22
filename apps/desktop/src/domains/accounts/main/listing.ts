// The Account set as the renderer draws it: secret-free records with the Connections each one feeds.

import {
  type AccountConnection,
  type AccountError,
  type AccountListed,
  type AccountState,
  type AccountSummary,
  accountError,
} from '@/domains/accounts/contract/contract'
import { type AccountAccess, accountState, projectNames } from '@/domains/accounts/main/access'
import { availableProviders } from '@/domains/accounts/main/providers'
import {
  type AccountRecord,
  type AccountRegistry,
  readAccounts,
  writeAccounts,
} from '@/domains/accounts/main/registry'
import { readConnections } from '@/domains/connections/main'

// Named field by field, so a field added to the stored record never reaches the renderer by
// accident; the grant lives in another file entirely.
function summary(
  account: AccountRecord,
  state: AccountState,
  connections: AccountConnection[],
): AccountSummary {
  const { id, provider, login, workspace } = account
  return { id, provider, login, workspace, state, connections }
}

export async function listing(
  access: AccountAccess,
  registry: AccountRegistry,
): Promise<Pick<AccountListed, 'accounts' | 'notice' | 'providers'>> {
  const [connections, names] = await Promise.all([
    readConnections(access.paths.connections),
    projectNames(access),
  ])
  const known = connections.ok ? connections.document.connections : []
  const accounts = await Promise.all(
    registry.accounts.map(async (account) =>
      summary(
        account,
        await accountState(access, account),
        known.flatMap((connection) => {
          const projectName = names.get(connection.projectId)
          if (connection.accountId !== account.id || projectName === undefined) return []
          return [{ projectId: connection.projectId, projectName, label: connection.label }]
        }),
      ),
    ),
  )
  return {
    accounts,
    notice: !registry.noticeDismissed,
    providers: availableProviders(access.providers, access.endpoints),
  }
}

const STORAGE_ERRORS = { unreadable: 'storage-unavailable', invalid: 'storage-invalid' } as const

export async function listed(
  access: AccountAccess,
  requestId: string,
): Promise<AccountListed | AccountError> {
  const read = await readAccounts(access.paths.accounts)
  if (!read.ok) return accountError(STORAGE_ERRORS[read.reason], requestId)
  return {
    version: 1,
    type: 'account.listed',
    requestId,
    ...(await listing(access, read.registry)),
  }
}

// Read, change and write the registry as one step in the queue, then answer with the whole set.
export function updateAccounts(
  access: AccountAccess,
  requestId: string,
  change: (registry: AccountRegistry) => Promise<AccountRegistry | AccountError>,
): Promise<AccountListed | AccountError> {
  return access.exclusive(async () => {
    const read = await readAccounts(access.paths.accounts)
    if (!read.ok) return accountError(STORAGE_ERRORS[read.reason], requestId)
    const next = await change(read.registry)
    if ('type' in next) return next
    if (!(await writeAccounts(access.paths.accounts, next))) {
      return accountError('storage-not-written', requestId)
    }
    return { version: 1, type: 'account.listed', requestId, ...(await listing(access, next)) }
  })
}

export function disconnect(access: AccountAccess, requestId: string, accountId: string) {
  return updateAccounts(access, requestId, async (registry) => {
    if (!registry.accounts.some((account) => account.id === accountId)) {
      return accountError('missing-account', requestId)
    }
    // The grant goes first: a record without a grant reads as needing a reconnect, where a grant
    // without a record would be a token nothing names.
    if (!(await access.grants.remove(accountId)))
      return accountError('storage-not-written', requestId)
    return {
      ...registry,
      accounts: registry.accounts.filter((account) => account.id !== accountId),
    }
  })
}

export function dismissNotice(access: AccountAccess, requestId: string) {
  return updateAccounts(access, requestId, async (registry) => ({
    ...registry,
    noticeDismissed: true,
  }))
}

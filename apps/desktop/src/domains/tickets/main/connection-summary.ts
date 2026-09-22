import type { AccountState } from '@/domains/accounts/contract/contract'
import { type AccountAccess, accountState, readAccounts } from '@/domains/accounts/main/port'
import type { TicketConnection } from '@/domains/connections/main/port'
import type { ConnectionState, ConnectionSummary } from '@/domains/tickets/contract/contract'

const ACCOUNT_STATES: Record<AccountState, ConnectionState> = {
  connected: 'ready',
  expired: 'account-expired',
  revoked: 'account-revoked',
  unreadable: 'account-unreadable',
}

export async function connectionSummary(
  access: AccountAccess,
  connection: TicketConnection,
): Promise<ConnectionSummary> {
  const read = await readAccounts(access.paths.accounts)
  const account = read.ok
    ? read.registry.accounts.find((candidate) => candidate.id === connection.accountId)
    : undefined
  const { accountId, provider, scope, label } = connection
  const known = { accountId, provider, scope, label }
  if (!account) return { ...known, login: null, state: 'account-missing' }
  return {
    ...known,
    login: account.login,
    state: ACCOUNT_STATES[await accountState(access, account)],
  }
}

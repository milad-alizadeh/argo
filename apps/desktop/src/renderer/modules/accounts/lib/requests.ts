// Every Account request the cockpit sends.
import type { AccountDisconnectRequest } from '@/core/accounts/contract'
import { nextRequestId } from '../../../lib/requests'

export const accountAction = <const Type extends string>(type: Type) => ({
  version: 1 as const,
  type,
  requestId: nextRequestId(),
})

export const disconnectRequest = (accountId: string): AccountDisconnectRequest => ({
  ...accountAction('account.disconnect'),
  accountId,
})

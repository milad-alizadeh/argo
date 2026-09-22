import type { ClientErrorCode, MainErrorCode } from '@/shared/ipc/operations'
import type { ManagedSessionError } from './managed-session-contract'

export function managedSessionError(
  code: ClientErrorCode | MainErrorCode,
  requestId: string | null,
): ManagedSessionError {
  return { version: 1, type: 'managed-session.error', requestId, code }
}

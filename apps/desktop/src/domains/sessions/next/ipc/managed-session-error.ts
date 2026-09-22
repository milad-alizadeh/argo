import type { ManagedSessionError } from '@/domains/sessions/next/ipc/managed-session-contract'
import type { ClientErrorCode, MainErrorCode } from '@/shared/ipc/operations'

export function managedSessionError(
  code: ClientErrorCode | MainErrorCode,
  requestId: string | null,
): ManagedSessionError {
  return { version: 1, type: 'managed-session.error', requestId, code }
}

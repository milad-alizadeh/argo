import type { SessionError, SessionErrorCode } from '@/core/sessions/contract'
import { ContractError } from '@/platform/renderer/contract-error'

export class SessionContractError extends ContractError<SessionError> {
  declare code: SessionErrorCode

  constructor(reply: SessionError) {
    super(reply)
    this.name = 'SessionContractError'
  }
}

export function throwSessionContractError(reply: SessionError): never {
  throw new SessionContractError(reply)
}

export function throwUnexpectedSessionReply(reply: never): never {
  throw new Error(`Argo returned an unexpected Session reply: ${String(reply)}`)
}

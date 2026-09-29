import type { SessionError, SessionErrorCode } from '@/domains/sessions/api/session-error'
import { ContractError } from '@/platform/renderer/contract-error'

export class SessionContractError extends ContractError<SessionError> {
  declare code: SessionErrorCode

  constructor(reply: SessionError) {
    super(reply)
    this.name = 'SessionContractError'
  }
}

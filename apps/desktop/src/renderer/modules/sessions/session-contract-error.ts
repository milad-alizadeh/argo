import type { SessionError, SessionErrorCode } from '@/core/sessions/contract'

export class SessionContractError extends Error {
  version: 1 = 1
  type: 'session.error' = 'session.error'
  requestId: string | null
  code: SessionErrorCode

  constructor({ code, message, requestId }: SessionError) {
    super(message)
    this.name = 'SessionContractError'
    this.requestId = requestId
    this.code = code
  }
}

export function throwSessionContractError(reply: SessionError): never {
  throw new SessionContractError(reply)
}

export function throwUnexpectedSessionReply(reply: never): never {
  throw new Error(`Argo returned an unexpected Session reply: ${String(reply)}`)
}

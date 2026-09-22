import { driveSessionError, sessionError } from '@/domains/sessions/contract/session-error'

export type DriverErrorCode =
  | 'harness-unavailable'
  | 'launch-failed'
  | 'not-drivable'
  | 'held-elsewhere'
  | 'missing-session'

function messageFor(code: DriverErrorCode): string {
  return code === 'missing-session'
    ? sessionError(code, null).message
    : driveSessionError(code, 'claude', null).message
}

export class ClaudeSessionDriverError extends Error {
  readonly code: DriverErrorCode

  constructor(code: DriverErrorCode) {
    super(messageFor(code))
    this.code = code
  }
}

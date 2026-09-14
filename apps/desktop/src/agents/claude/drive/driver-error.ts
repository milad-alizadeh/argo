import { driveSessionError, sessionError } from '@/core/sessions/session-error'

export type DriverErrorCode =
  | 'cli-unavailable'
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
  constructor(readonly code: DriverErrorCode) {
    super(messageFor(code))
  }
}

import { SESSION_ERRORS } from '@/core/sessions/session-error'

type DriverErrorCode =
  | 'cli-unavailable'
  | 'launch-failed'
  | 'not-drivable'
  | 'not-resumable'
  | 'held-elsewhere'
  | 'missing-session'

export class ClaudeSessionDriverError extends Error {
  constructor(readonly code: DriverErrorCode) {
    super(SESSION_ERRORS[code])
  }
}

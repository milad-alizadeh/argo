import {
  type DriveSessionErrorCode,
  driveSessionError,
  sessionError,
} from '@/domains/sessions/contract/session-error'

export type CodexDriverErrorCode = DriveSessionErrorCode | 'missing-session'

function messageFor(code: CodexDriverErrorCode): string {
  return code === 'missing-session'
    ? sessionError(code, null).message
    : driveSessionError(code, 'codex', null).message
}

export class CodexSessionDriverError extends Error {
  readonly code: CodexDriverErrorCode

  constructor(code: CodexDriverErrorCode) {
    super(messageFor(code))
    this.code = code
  }
}

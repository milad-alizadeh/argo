import {
  type DriveSessionErrorCode,
  driveSessionError,
  sessionError,
} from '../../../core/sessions/session-error'

export type CodexDriverErrorCode = DriveSessionErrorCode | 'missing-session'

function messageFor(code: CodexDriverErrorCode): string {
  return code === 'missing-session'
    ? sessionError(code, null).message
    : driveSessionError(code, 'codex', null).message
}

export class CodexSessionDriverError extends Error {
  constructor(readonly code: CodexDriverErrorCode) {
    super(messageFor(code))
  }
}

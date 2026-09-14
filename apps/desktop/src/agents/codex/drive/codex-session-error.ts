import { type DriveSessionErrorCode, driveSessionError } from '../../../core/sessions/session-error'

export class CodexSessionDriverError extends Error {
  constructor(readonly code: DriveSessionErrorCode) {
    super(driveSessionError(code, 'codex', null).message)
  }
}

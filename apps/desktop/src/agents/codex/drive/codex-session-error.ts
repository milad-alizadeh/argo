import { driveSessionError } from '@/core/sessions/session-error'

export class CodexSessionDriverError extends Error {
  constructor(readonly code: 'cli-unavailable' | 'launch-failed') {
    super(driveSessionError(code, 'codex', null).message)
  }
}

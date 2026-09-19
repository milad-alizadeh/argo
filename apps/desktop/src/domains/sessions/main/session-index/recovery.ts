import { isRecord } from '../../../../shared/validation'

const RECOVERABLE_SQLITE_CODES = new Set([5, 6, 11, 17, 26])
const DAMAGED_SQLITE_CODES = new Set([11, 17, 26])

export class SessionIndexFallbackError extends Error {
  readonly recovery: 'busy' | 'damaged'

  constructor(recovery: 'busy' | 'damaged', cause: unknown) {
    super('The Session index is temporarily unavailable.', { cause })
    this.name = 'SessionIndexFallbackError'
    this.recovery = recovery
  }
}

export function recoverableIndexOperation<Result>(operation: () => Result): Result {
  try {
    return operation()
  } catch (error) {
    if (
      isRecord(error) &&
      error.code === 'ERR_SQLITE_ERROR' &&
      typeof error.errcode === 'number' &&
      RECOVERABLE_SQLITE_CODES.has(error.errcode)
    ) {
      throw new SessionIndexFallbackError(sessionIndexRecoveryKind(error) ?? 'busy', error)
    }
    throw error
  }
}

export function sessionIndexRecoveryKind(error: unknown): 'busy' | 'damaged' | null {
  if (
    !isRecord(error) ||
    error.code !== 'ERR_SQLITE_ERROR' ||
    typeof error.errcode !== 'number' ||
    !RECOVERABLE_SQLITE_CODES.has(error.errcode)
  ) {
    return null
  }
  return DAMAGED_SQLITE_CODES.has(error.errcode) ? 'damaged' : 'busy'
}

export function isSessionIndexFallback(error: unknown): error is SessionIndexFallbackError {
  return error instanceof SessionIndexFallbackError
}

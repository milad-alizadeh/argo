import type { SessionErrorCode } from '@/core/sessions/contract'

export function sessionFailureState(code: SessionErrorCode) {
  switch (code) {
    case 'access-denied':
    case 'cli-unavailable':
    case 'held-elsewhere':
    case 'missing-session':
    case 'transcripts-unavailable':
      return 'unavailable'
    case 'connection-lost':
    case 'internal-error':
    case 'invalid-request':
    case 'invalid-response':
    case 'launch-failed':
    case 'not-drivable':
    case 'stale-permission':
    case 'unsupported-version':
      return 'error'
  }
}

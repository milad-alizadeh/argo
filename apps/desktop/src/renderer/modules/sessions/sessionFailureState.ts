import type { SessionErrorCode } from '@/core/sessions/contract'

export function sessionFailureState(code: SessionErrorCode) {
  switch (code) {
    case 'access-denied':
    case 'cli-unavailable':
    case 'held-elsewhere':
    case 'codex-held-elsewhere':
    case 'missing-session':
    case 'not-resumable':
    case 'transcripts-unavailable':
      return 'unavailable'
    case 'connection-lost':
    case 'internal-error':
    case 'invalid-request':
    case 'invalid-response':
    case 'launch-failed':
    case 'not-drivable':
    case 'unsupported-version':
      return 'error'
  }
}

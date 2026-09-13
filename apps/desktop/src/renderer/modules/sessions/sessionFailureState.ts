import type { SessionError } from './types'

export function sessionFailureState(failure: SessionError) {
  switch (failure.code) {
    case 'access-denied':
    case 'cli-unavailable':
    case 'missing-session':
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

import type { Failure } from '../composer/send/session-failure'
import type { SessionError } from '../types'

export function suppressMissingSessionFailure({
  failure,
  feedError,
  feedStalledSessionId,
  selectedSessionId,
}: {
  failure: Pick<Failure, 'code'> | null
  feedError: Pick<SessionError, 'requestId'> | null
  feedStalledSessionId: string | null
  selectedSessionId: string | null
}) {
  return (
    selectedSessionId !== null &&
    failure?.code === 'missing-session' &&
    (feedStalledSessionId === selectedSessionId || feedError?.requestId === selectedSessionId)
  )
}

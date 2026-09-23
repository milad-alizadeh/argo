import type { Failure } from '../composer/send/session-failure'
export function suppressMissingSessionFailure({
  failure,
  feedFailureSessionId,
  feedStalledSessionId,
  selectedSessionId,
}: {
  failure: Pick<Failure, 'code'> | null
  feedFailureSessionId: string | null
  feedStalledSessionId: string | null
  selectedSessionId: string | null
}) {
  return (
    selectedSessionId !== null &&
    failure?.code === 'missing-session' &&
    (feedStalledSessionId === selectedSessionId || feedFailureSessionId === selectedSessionId)
  )
}

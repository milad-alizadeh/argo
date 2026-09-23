import type { Failure } from '../composer/send/session-failure'
export function suppressMissingSessionFailure({
  failure,
  feedFailed,
  feedStalledSessionId,
  selectedSessionId,
}: {
  failure: Pick<Failure, 'code'> | null
  feedFailed: boolean
  feedStalledSessionId: string | null
  selectedSessionId: string | null
}) {
  return (
    selectedSessionId !== null &&
    failure?.code === 'missing-session' &&
    (feedStalledSessionId === selectedSessionId || feedFailed)
  )
}

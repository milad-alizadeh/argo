import type { SessionErrorCode } from '@/domains/sessions/api/session-error'
export function suppressMissingSessionFailure({
  failure,
  feedFailureSessionId,
  feedStalledSessionId,
  selectedSessionId,
}: {
  failure: { code: SessionErrorCode } | null
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

import { useCallback, useEffect, useRef } from 'react'
import type { SessionRosterRow } from '@/core/sessions/models'
import { codeFrom, type Failure, messageFrom } from './useSessionComposer-actions'
import type { useSessionMutations } from './useSessionMutations'

export function useHandoff(
  handoff: ReturnType<typeof useSessionMutations>['handoff'],
  sessionId: string | null,
  setFailure: (failure: Failure | null) => void,
) {
  return useCallback(async () => {
    if (sessionId === null) return false
    try {
      await handoff.mutateAsync(sessionId)
      setFailure(null)
      return true
    } catch (error) {
      setFailure({
        sessionId,
        message: messageFrom(error, 'Argo could not hand off this Session.'),
        code: codeFrom(error),
      })
      return false
    }
  }, [handoff, sessionId, setFailure])
}

// A handoff that completes is told only through the roster: success clears `handoffStartedAt`
// and names `handoffTo`, a failure clears it and names `handoffFailure` instead. On success the
// reader stays on the source Session; the Feed shows an "Open Session" link to `handoffTo`
// instead of navigating the reader away.
export function useHandoffCompletion(options: {
  isHandingOff: boolean
  selectedRow: SessionRosterRow | null
  selectedSessionId: string | null
  setFailure: (failure: Failure | null) => void
}) {
  const { isHandingOff, selectedRow, selectedSessionId, setFailure } = options
  const watch = useRef<{ sessionId: string | null; wasHandingOff: boolean }>({
    sessionId: null,
    wasHandingOff: false,
  })
  useEffect(() => {
    const previous = watch.current
    if (
      previous.sessionId === selectedSessionId &&
      previous.wasHandingOff &&
      !isHandingOff &&
      selectedRow?.handoffFailure
    ) {
      setFailure({
        sessionId: selectedSessionId,
        message: selectedRow.handoffFailure,
        code: null,
      })
    }
    watch.current = { sessionId: selectedSessionId, wasHandingOff: isHandingOff }
  }, [isHandingOff, selectedRow, selectedSessionId, setFailure])
}

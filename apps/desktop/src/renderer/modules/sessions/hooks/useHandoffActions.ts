import { useCallback, useEffect, useRef } from 'react'
import type { NavigateFunction } from 'react-router'
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
// and names `handoffTo`, a failure clears it and names `handoffFailure` instead.
export function useHandoffCompletion(options: {
  isHandingOff: boolean
  selectedRow: SessionRosterRow | null
  selectedSessionId: string | null
  navigate: NavigateFunction
  setFailure: (failure: Failure | null) => void
}) {
  const { isHandingOff, selectedRow, selectedSessionId, navigate, setFailure } = options
  const watch = useRef<{ sessionId: string | null; wasHandingOff: boolean }>({
    sessionId: null,
    wasHandingOff: false,
  })
  useEffect(() => {
    const previous = watch.current
    if (previous.sessionId === selectedSessionId && previous.wasHandingOff && !isHandingOff) {
      if (selectedRow?.handoffFailure) {
        setFailure({
          sessionId: selectedSessionId,
          message: selectedRow.handoffFailure,
          code: null,
        })
      } else if (selectedRow?.handoffTo) {
        navigate(`/sessions/${selectedRow.handoffTo}`)
      }
    }
    watch.current = { sessionId: selectedSessionId, wasHandingOff: isHandingOff }
  }, [isHandingOff, navigate, selectedRow, selectedSessionId, setFailure])
}

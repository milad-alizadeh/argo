import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import type { NavigateFunction } from 'react-router'
import type { SessionErrorCode } from '@/core/sessions/contract'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { Cockpit } from '../../projects/hooks/useProjects'
import { COMPOSER_FOCUS_STATE, type SessionComposerProps } from '../components/SessionComposer'
import { HARNESSES, type SessionCli } from '../harness/harnesses'
import { invalidateSessionRoster } from '../session-queries'
import type { TurnSetup } from '../turn-setup/turn-setup'
import { useTurnSetup } from '../turn-setup/useTurnSetup'
import { sessionComposerProps } from './sessionComposerProps'
import type { Failure } from './useSessionComposer-actions'
import {
  sendMessage,
  startNewSession,
  useCompact,
  useInterrupt,
} from './useSessionComposer-actions'
import { useSessionMutations } from './useSessionMutations'
import type { useSessions } from './useSessions'

const NO_ROWS: SessionRosterRow[] = []

type SessionComposerOptions = {
  cli: SessionCli
  cockpit: Cockpit
  focusOnMount: boolean
  navigate: NavigateFunction
  roster: ReturnType<typeof useSessions>['roster']
  selectedSessionId: string | null
}

function managedSessionIsRunning(
  roster: SessionComposerOptions['roster'],
  sessionId: string | null,
): boolean {
  return (
    roster?.sessions.some(
      (session) =>
        session.id === sessionId && session.posture === 'managed' && session.status === 'running',
    ) ?? false
  )
}

export function useSessionComposer({
  cli,
  cockpit,
  focusOnMount,
  navigate,
  roster,
  selectedSessionId,
}: SessionComposerOptions): {
  failure: { message: string; code: SessionErrorCode | null } | null
  props: Omit<SessionComposerProps, 'plan' | 'harness'>
} {
  const [failure, setFailure] = useState<Failure | null>(null)
  const queryClient = useQueryClient()
  const { compact, interrupt, send, start } = useSessionMutations()
  const composerKey = selectedSessionId ?? `new:${cockpit.project?.id ?? 'unselected'}`
  const { control, watchTurn } = useTurnSetup({
    cli,
    choices: HARNESSES[cli].setup,
    composerKey,
    rows: roster?.sessions ?? NO_ROWS,
    onRefusal: (refusal) => setFailure({ ...refusal, code: null }),
  })
  const compactSession = useCompact(compact, selectedSessionId, setFailure)
  const onCompact = useCallback(async () => {
    const compacted = await compactSession()
    if (compacted) await invalidateSessionRoster(queryClient)
    return compacted
  }, [compactSession, queryClient])
  const onInterrupt = useInterrupt(interrupt, selectedSessionId, setFailure)
  const isCompacting =
    (roster?.sessions.find(({ id }) => id === selectedSessionId)?.compactionStartedAt ?? null) !==
    null
  const onSend = useCallback(
    async (prompt: string, setup: TurnSetup | null) => {
      if (selectedSessionId !== null) {
        const since =
          roster?.sessions.find(({ id }) => id === selectedSessionId)?.turnStartedAt ?? null
        return sendMessage(
          { send, prompt, setup, sessionId: selectedSessionId, setFailure },
          () => {
            if (setup !== null) watchTurn(selectedSessionId, setup, since)
            // A Send can resume the Session (ADR-0026), so its posture may have changed.
            return invalidateSessionRoster(queryClient)
          },
        )
      }
      return startNewSession(
        { cli, cockpit, prompt, setup, start, setFailure },
        (sessionId) => {
          if (setup !== null) watchTurn(sessionId, setup, null)
          return invalidateSessionRoster(queryClient)
        },
        (sessionId) => navigate(`/sessions/${sessionId}`, { state: COMPOSER_FOCUS_STATE }),
      )
    },
    [cli, cockpit, navigate, queryClient, roster, selectedSessionId, send, start, watchTurn],
  )
  return {
    failure:
      failure?.sessionId === selectedSessionId
        ? { message: failure.message, code: failure.code }
        : null,
    props: sessionComposerProps({
      cli,
      isRunning: managedSessionIsRunning(roster, selectedSessionId),
      focusOnMount,
      isCompacting,
      onCompact,
      onInterrupt,
      onSend,
      sessionId: composerKey,
      setup: control,
      selectedSessionId,
    }),
  }
}

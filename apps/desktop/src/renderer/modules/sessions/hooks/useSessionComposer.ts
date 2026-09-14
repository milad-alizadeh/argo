import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import type { NavigateFunction } from 'react-router'
import type { SessionErrorCode } from '@/core/sessions/contract'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { Cockpit } from '../../projects/hooks/useProjects'
import type { SessionComposerProps } from '../components/SessionComposer'
import { HARNESSES, type SessionCli } from '../harness/harnesses'
import { invalidateSessionRoster } from '../session-queries'
import { useTurnSetup } from '../turn-setup/useTurnSetup'
import { composerIdentityKey, composerIdentityOf } from './composerIdentity'
import { sessionComposerProps } from './sessionComposerProps'
import { useComposerSend } from './useComposerSend'
import type { Failure } from './useSessionComposer-actions'
import { useCompact, useInterrupt } from './useSessionComposer-actions'
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
  const identity = composerIdentityOf(selectedSessionId, cockpit.project?.id ?? null)
  const sessionId = identity.kind === 'session' ? identity.sessionId : null
  const { control, watchTurn } = useTurnSetup({
    cli,
    choices: HARNESSES[cli].setup,
    identity,
    rows: roster?.sessions ?? NO_ROWS,
    onRefusal: (refusal) => setFailure({ ...refusal, code: null }),
  })
  const compactSession = useCompact(compact, sessionId, setFailure)
  const onCompact = useCallback(async () => {
    const compacted = await compactSession()
    if (compacted) await invalidateSessionRoster(queryClient)
    return compacted
  }, [compactSession, queryClient])
  const onInterrupt = useInterrupt(interrupt, sessionId, setFailure)
  const isCompacting =
    (roster?.sessions.find(({ id }) => id === sessionId)?.compactionStartedAt ?? null) !== null
  const onSend = useComposerSend({
    cli,
    cockpit,
    navigate,
    queryClient,
    roster,
    identity,
    send,
    setFailure,
    start,
    watchTurn,
  })
  return {
    failure:
      failure?.sessionId === sessionId ? { message: failure.message, code: failure.code } : null,
    props: sessionComposerProps({
      isRunning: managedSessionIsRunning(roster, sessionId),
      focusOnMount,
      isCompacting,
      onCompact,
      onInterrupt,
      onSend,
      sessionId: composerIdentityKey(identity),
      setup: control,
      identity,
    }),
  }
}

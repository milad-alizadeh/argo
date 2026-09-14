import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import type { NavigateFunction } from 'react-router'
import type { SessionErrorCode } from '@/core/sessions/contract'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { Cockpit } from '../../projects/hooks/useProjects'
import type { SessionComposerProps } from '../components/SessionComposer'
import { HARNESSES, type SessionCli } from '../harness/harnesses'
import { invalidateSessionRoster } from '../session-queries'
import type { TurnSetup } from '../turn-setup/turn-setup'
import { useTurnSetup } from '../turn-setup/useTurnSetup'
import { sessionComposerProps } from './sessionComposerProps'
import { sendMessage, startSession } from './sessionSend'
import { useClaudeSessionMutations } from './useClaudeSessionMutations'
import { useCodexSessionMutations } from './useCodexSessionMutations'
import { useCompact, useInterrupt } from './useSessionActions'
import type { useSessions } from './useSessions'

const NO_ROWS: SessionRosterRow[] = []

// A failure belongs to the Session it happened on, so selecting another Session does not show it.
// `code` is null for a failure with no Session error code (a client-side refusal, for example).
type Failure = { sessionId: string | null; message: string; code: SessionErrorCode | null }

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

function sessionState(roster: SessionComposerOptions['roster'], sessionId: string | null) {
  const selectedSession = roster?.sessions.find(({ id }) => id === sessionId)
  const compactionStartedAt = selectedSession?.compactionStartedAt ?? null
  const isCompacting = compactionStartedAt !== null
  return { isCompacting, isRunning: managedSessionIsRunning(roster, sessionId) || isCompacting }
}

// A CLI's own hook owns its IPC calls (ADR-0021); this is the one seam that picks between them,
// so the composer it hands back never has to know which CLI it is driving.
function useMutationsFor(cli: SessionCli) {
  const mutationsByCli = { claude: useClaudeSessionMutations(), codex: useCodexSessionMutations() }
  return mutationsByCli[cli]
}

function useRefreshedCompact(
  compactSession: () => Promise<boolean>,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return useCallback(async () => {
    const compacted = await compactSession()
    if (compacted) await invalidateSessionRoster(queryClient)
    return compacted
  }, [compactSession, queryClient])
}

export type SessionMutations = ReturnType<typeof useMutationsFor>

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
  const { compact } = useClaudeSessionMutations()
  const { interrupt, send, start } = useMutationsFor(cli)
  const composerKey = selectedSessionId ?? `new:${cockpit.project?.id ?? 'unselected'}`
  const { control, watchTurn } = useTurnSetup({
    cli,
    choices: HARNESSES[cli].setup,
    composerKey,
    rows: roster?.sessions ?? NO_ROWS,
    onRefusal: (refusal) => setFailure({ ...refusal, code: null }),
  })
  const compactSession = useCompact({ compact, cli, sessionId: selectedSessionId, setFailure })
  const onCompact = useRefreshedCompact(compactSession, queryClient)
  const onInterrupt = useInterrupt({ interrupt, sessionId: selectedSessionId, setFailure })
  const { isCompacting, isRunning } = sessionState(roster, selectedSessionId)
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
      return startSession({
        cockpit,
        navigate,
        prompt,
        queryClient,
        setFailure,
        setup,
        start,
        watchTurn,
      })
    },
    [cockpit, navigate, queryClient, roster, selectedSessionId, send, start, watchTurn],
  )
  const active = failure?.sessionId === selectedSessionId ? failure : null
  return {
    failure: active === null ? null : { message: active.message, code: active.code },
    props: sessionComposerProps({
      cli,
      focusOnMount,
      isCompacting,
      isRunning,
      onCompact,
      onInterrupt,
      onSend,
      selectedSessionId,
      sessionId: composerKey,
      setup: control,
    }),
  }
}

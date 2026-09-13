import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import type { NavigateFunction } from 'react-router'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { Cockpit } from '../../projects/hooks/useProjects'
import { COMPOSER_FOCUS_STATE, type SessionComposerProps } from '../components/SessionComposer'
import { HARNESSES, type SessionCli } from '../harness/harnesses'
import { invalidateSessionRoster } from '../session-queries'
import type { TurnSetup } from '../turn-setup/turn-setup'
import { useTurnSetup } from '../turn-setup/useTurnSetup'
import { useClaudeSessionMutations } from './useClaudeSessionMutations'
import { useCodexSessionMutations } from './useCodexSessionMutations'
import type { useSessions } from './useSessions'

const NO_ROWS: SessionRosterRow[] = []

// A failure belongs to the Session it happened on, so selecting another Session does not show it.
type Failure = { sessionId: string | null; message: string }

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

// A CLI's own hook owns its IPC calls (ADR-0021); this is the one seam that picks between them,
// so the composer it hands back never has to know which CLI it is driving.
function useMutationsFor(cli: SessionCli) {
  const mutationsByCli = { claude: useClaudeSessionMutations(), codex: useCodexSessionMutations() }
  return mutationsByCli[cli]
}

export function useSessionComposer({
  cli,
  cockpit,
  focusOnMount,
  navigate,
  roster,
  selectedSessionId,
}: SessionComposerOptions): {
  failure: string | null
  props: Omit<SessionComposerProps, 'plan' | 'harness'>
} {
  const [failure, setFailure] = useState<Failure | null>(null)
  const queryClient = useQueryClient()
  const { compact, interrupt, send, start } = useMutationsFor(cli)
  const composerKey = selectedSessionId ?? `new:${cockpit.project?.id ?? 'unselected'}`
  const { control, watchTurn } = useTurnSetup({
    cli,
    choices: HARNESSES[cli].setup,
    composerKey,
    rows: roster?.sessions ?? NO_ROWS,
    onRefusal: setFailure,
  })
  const onInterrupt = useInterrupt(interrupt, selectedSessionId, setFailure)
  const onCompact = useInterrupt(compact, selectedSessionId, setFailure)
  const selectedSession = roster?.sessions.find(({ id }) => id === selectedSessionId)
  const isCompacting =
    selectedSession?.compactionStartedAt !== null && selectedSession !== undefined
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
      if (cockpit.project === null) {
        setFailure({ sessionId: null, message: 'Select a Project before starting a Session.' })
        return false
      }
      try {
        const reply = await start.mutateAsync({ cwd: cockpit.project.path, prompt, setup })
        setFailure(null)
        if (setup !== null) watchTurn(reply.sessionId, setup, null)
        await invalidateSessionRoster(queryClient)
        navigate(`/sessions/${reply.sessionId}`, { state: COMPOSER_FOCUS_STATE })
        return true
      } catch (error) {
        setFailure({
          sessionId: null,
          message: messageFrom(error, 'Argo could not start this Session.'),
        })
        return false
      }
    },
    [cockpit.project, navigate, queryClient, roster, selectedSessionId, send, start, watchTurn],
  )
  return {
    failure: failure?.sessionId === selectedSessionId ? failure.message : null,
    props: {
      isCompacting,
      isRunning: managedSessionIsRunning(roster, selectedSessionId) || isCompacting,
      focusOnMount,
      onInterrupt,
      onCompact: cli === 'claude' && selectedSessionId !== null ? onCompact : undefined,
      onSend,
      sessionId: composerKey,
      setup: control,
    },
  }
}

function useInterrupt(
  interrupt: ReturnType<typeof useMutationsFor>['interrupt'],
  sessionId: string | null,
  setFailure: (failure: Failure | null) => void,
) {
  return useCallback(async () => {
    if (sessionId === null) return false
    try {
      await interrupt.mutateAsync(sessionId)
      return true
    } catch (error) {
      setFailure({
        sessionId,
        message: messageFrom(error, 'Argo could not interrupt this Session.'),
      })
      return false
    }
  }, [interrupt, sessionId, setFailure])
}

async function sendMessage(
  request: {
    send: ReturnType<typeof useMutationsFor>['send']
    prompt: string
    setup: TurnSetup | null
    sessionId: string
    setFailure: (failure: Failure | null) => void
  },
  afterSend: () => Promise<void>,
) {
  const { send, prompt, setup, sessionId, setFailure } = request
  try {
    await send.mutateAsync({ prompt, sessionId, setup })
    setFailure(null)
  } catch (error) {
    setFailure({ sessionId, message: messageFrom(error, 'Argo could not send this message.') })
    return false
  }
  await afterSend()
  return true
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

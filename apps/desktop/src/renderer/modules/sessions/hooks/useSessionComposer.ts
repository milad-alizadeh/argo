import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import type { NavigateFunction } from 'react-router'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { Cockpit } from '../../projects/hooks/useProjects'
import type { SessionComposerProps } from '../components/SessionComposer'
import { invalidateSessionRoster } from '../session-queries'
import { CLAUDE_TURN_SETUP } from '../turn-setup/claude-turn-setup'
import type { TurnSetup, TurnSetupChoices } from '../turn-setup/turn-setup'
import { useTurnSetup } from '../turn-setup/useTurnSetup'
import { useClaudeSessionMutations } from './useClaudeSessionMutations'
import { useCodexSessionMutations } from './useCodexSessionMutations'
import type { useSessions } from './useSessions'

export type SessionCli = 'claude' | 'codex'

const NO_ROWS: SessionRosterRow[] = []

type SessionComposerOptions = {
  cli: SessionCli
  cockpit: Cockpit
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

// What each CLI lets a person set for its next Turn; Codex declares nothing yet, so draws nothing.
const turnSetupByCli: Record<SessionCli, TurnSetupChoices | null> = {
  claude: CLAUDE_TURN_SETUP,
  codex: null,
}

export function useSessionComposer({
  cli,
  cockpit,
  navigate,
  roster,
  selectedSessionId,
}: SessionComposerOptions): {
  failure: string | null
  props: Omit<SessionComposerProps, 'plan'>
} {
  const [failure, setFailure] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { interrupt, send, start } = useMutationsFor(cli)
  const composerKey = selectedSessionId ?? `new:${cockpit.project?.id ?? 'unselected'}`
  const { control, watchTurn } = useTurnSetup({
    cli,
    choices: turnSetupByCli[cli],
    composerKey,
    rows: roster?.sessions ?? NO_ROWS,
    onRefusal: setFailure,
  })
  const onInterrupt = useInterrupt(interrupt, selectedSessionId, setFailure)
  const onSend = useCallback(
    async (prompt: string, setup: TurnSetup | null) => {
      if (selectedSessionId !== null) {
        const since =
          roster?.sessions.find(({ id }) => id === selectedSessionId)?.turnStartedAt ?? null
        const sent = await sendMessage({
          send,
          prompt,
          setup,
          sessionId: selectedSessionId,
          setFailure,
        })
        if (sent && setup !== null) watchTurn(selectedSessionId, setup, since)
        return sent
      }
      if (cockpit.project === null) {
        setFailure('Select a Project before starting a Session.')
        return false
      }
      try {
        const reply = await start.mutateAsync({ cwd: cockpit.project.path, prompt, setup })
        setFailure(null)
        if (setup !== null) watchTurn(reply.sessionId, setup, null)
        await invalidateSessionRoster(queryClient)
        navigate(`/sessions/${reply.sessionId}`)
        return true
      } catch (error) {
        setFailure(messageFrom(error, 'Argo could not start this Session.'))
        return false
      }
    },
    [cockpit.project, navigate, queryClient, roster, selectedSessionId, send, start, watchTurn],
  )
  return {
    failure,
    props: {
      isRunning: managedSessionIsRunning(roster, selectedSessionId),
      onInterrupt,
      onSend,
      sessionId: composerKey,
      setup: control,
    },
  }
}

function useInterrupt(
  interrupt: ReturnType<typeof useMutationsFor>['interrupt'],
  sessionId: string | null,
  setFailure: (message: string | null) => void,
) {
  return useCallback(async () => {
    if (sessionId === null) return false
    try {
      await interrupt.mutateAsync(sessionId)
      return true
    } catch (error) {
      setFailure(messageFrom(error, 'Argo could not interrupt this Session.'))
      return false
    }
  }, [interrupt, sessionId, setFailure])
}

async function sendMessage({
  send,
  prompt,
  setup,
  sessionId,
  setFailure,
}: {
  send: ReturnType<typeof useMutationsFor>['send']
  prompt: string
  setup: TurnSetup | null
  sessionId: string
  setFailure: (message: string | null) => void
}) {
  try {
    await send.mutateAsync({ prompt, sessionId, setup })
    setFailure(null)
    return true
  } catch (error) {
    setFailure(messageFrom(error, 'Argo could not send this message.'))
    return false
  }
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

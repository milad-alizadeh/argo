import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '../../projects/hooks/useProjects'
import type { SessionComposerProps } from '../components/SessionComposer'
import { invalidateSessionRoster } from '../session-queries'
import { useClaudeSessionMutations } from './useClaudeSessionMutations'
import type { useSessions } from './useSessions'

type ClaudeComposerOptions = {
  cockpit: Cockpit
  navigate: NavigateFunction
  roster: ReturnType<typeof useSessions>['roster']
  selectedSessionId: string | null
}

function managedSessionIsRunning(
  roster: ClaudeComposerOptions['roster'],
  sessionId: string | null,
): boolean {
  return (
    roster?.sessions.some(
      (session) =>
        session.id === sessionId && session.posture === 'managed' && session.status === 'running',
    ) ?? false
  )
}

export function useClaudeComposer({
  cockpit,
  navigate,
  roster,
  selectedSessionId,
}: ClaudeComposerOptions): {
  failure: string | null
  props: SessionComposerProps
} {
  const [failure, setFailure] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { interrupt, send, start } = useClaudeSessionMutations()
  const onInterrupt = useCallback(async () => {
    if (selectedSessionId === null) return false
    try {
      await interrupt.mutateAsync(selectedSessionId)
      return true
    } catch (error) {
      setFailure(messageFrom(error, 'Argo could not interrupt this Session.'))
      return false
    }
  }, [interrupt, selectedSessionId])
  const onSend = useCallback(
    async (prompt: string) => {
      if (selectedSessionId !== null)
        return sendMessage({ send, prompt, sessionId: selectedSessionId, setFailure })
      if (cockpit.project === null) {
        setFailure('Select a Project before starting a Claude Session.')
        return false
      }
      try {
        const reply = await start.mutateAsync({ cwd: cockpit.project.path, prompt })
        setFailure(null)
        await invalidateSessionRoster(queryClient)
        navigate(`/sessions/${reply.sessionId}`)
        return true
      } catch (error) {
        setFailure(messageFrom(error, 'Argo could not start Claude Code.'))
        return false
      }
    },
    [cockpit.project, navigate, queryClient, selectedSessionId, send, start],
  )
  return {
    failure,
    props: {
      isRunning: managedSessionIsRunning(roster, selectedSessionId),
      onInterrupt,
      onSend,
      sessionId: selectedSessionId ?? `new:${cockpit.project?.id ?? 'unselected'}`,
    },
  }
}

async function sendMessage({
  send,
  prompt,
  sessionId,
  setFailure,
}: {
  send: ReturnType<typeof useClaudeSessionMutations>['send']
  prompt: string
  sessionId: string
  setFailure: (message: string) => void
}) {
  try {
    await send.mutateAsync({ prompt, sessionId })
    return true
  } catch (error) {
    setFailure(messageFrom(error, 'Argo could not send this message.'))
    return false
  }
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

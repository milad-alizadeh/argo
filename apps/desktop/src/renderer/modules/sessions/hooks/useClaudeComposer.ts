import { useCallback, useState } from 'react'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '../../projects/hooks/useProjects'
import type { SessionComposerProps } from '../components/SessionComposer'
import { rereadSessions, type useSessions } from './useSessions'

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
  const onInterrupt = useCallback(async () => {
    if (selectedSessionId === null) return false
    const reply = await window.argo.interruptClaudeSession({
      version: 1,
      type: 'session.claude.interrupt',
      requestId: crypto.randomUUID(),
      sessionId: selectedSessionId,
    })
    if (reply.type !== 'session.error') return true
    setFailure(reply.message)
    return false
  }, [selectedSessionId])
  const onSend = useCallback(
    async (prompt: string) => {
      if (selectedSessionId !== null) {
        const reply = await window.argo.sendClaudeSession({
          version: 1,
          type: 'session.claude.send',
          requestId: crypto.randomUUID(),
          sessionId: selectedSessionId,
          prompt,
        })
        if (reply.type !== 'session.error') return true
        setFailure(reply.message)
        return false
      }
      if (cockpit.project === null) {
        setFailure('Select a Project before starting a Claude Session.')
        return false
      }
      const reply = await window.argo.startClaudeSession({
        version: 1,
        type: 'session.claude.start',
        requestId: crypto.randomUUID(),
        cwd: cockpit.project.path,
        prompt,
      })
      if (reply.type === 'session.error') {
        setFailure(reply.message)
        return false
      }
      setFailure(null)
      rereadSessions()
      navigate(`/sessions/${reply.sessionId}`)
      return true
    },
    [cockpit.project, navigate, selectedSessionId],
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

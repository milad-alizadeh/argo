import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useProjects } from '../../projects/hooks/useProjects'
import { SessionComposerArea, SessionFacts } from '../components/SessionScreenDetails'
import { useClaudePermission } from '../hooks/useClaudePermission'
import type { SessionCli } from '../hooks/useSessionComposer'
import { useSessionComposer } from '../hooks/useSessionComposer'
import { useSessionInspector } from '../hooks/useSessionInspector'
import { useSessions } from '../hooks/useSessions'
import { SessionShell } from './SessionShell'

export function SessionScreenView() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [cockpit] = useProjects()
  const newSession = sessionId === 'new'
  const selectedSessionId = newSession ? null : (sessionId ?? null)
  const { feed, feedError, roster } = useSessions(selectedSessionId)
  const [newSessionCli, setNewSessionCli] = useState<SessionCli>('claude')
  const session = roster?.sessions.find(({ id }) => id === selectedSessionId) ?? null
  const cli: SessionCli = selectedSessionId === null ? newSessionCli : sessionCliOf(session)
  const composer = useSessionComposer({ cli, cockpit, navigate, roster, selectedSessionId })
  const permission = useClaudePermission(selectedSessionId)
  const inspector = useSessionInspector()

  return (
    <SessionShell
      inspectorState={inspector.inspectorState}
      inspectorPanelRef={inspector.inspectorPanelRef}
      workspacePanelRef={inspector.workspacePanelRef}
      onLayoutChanged={inspector.synchronizeInspectorCollapsed}
      onToggleInspector={inspector.toggleInspector}
      onToggleInspectorExpanded={inspector.toggleInspectorExpanded}
      feed={feed}
      feedError={feedError}
      selectedSessionId={selectedSessionId}
      composer={
        <SessionComposerArea
          composer={composer}
          permission={permission}
          session={session}
          cliPicker={
            selectedSessionId === null
              ? { cli: newSessionCli, onChangeCli: setNewSessionCli }
              : null
          }
        />
      }
      inspector={<SessionFacts session={session} />}
    />
  )
}

// The Roster stores an open `cli` string (ADR-0021: an adapter registers, shared code doesn't
// enumerate); this is the one seam that narrows it back to the closed `SessionCli` union.
function sessionCliOf(session: { cli: string } | null): SessionCli {
  return session?.cli === 'codex' ? 'codex' : 'claude'
}

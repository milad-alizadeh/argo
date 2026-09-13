import type { ReactNode } from 'react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { InspectorSplit } from '../../../components/InspectorSplit'
import { useProjects } from '../../projects/hooks/useProjects'
import { SessionComposerArea, SessionFacts } from '../components/SessionScreenDetails'
import type { SessionFeedRow } from '../types'
import { BasicFeed } from '../feed/BasicFeed'
import { useClaudePermission } from '../hooks/useClaudePermission'
import type { SessionCli } from '../hooks/useSessionComposer'
import { useSessionComposer } from '../hooks/useSessionComposer'
import { useSessions } from '../hooks/useSessions'

type SessionShellProps = {
  composer: ReactNode
  inspector: ReactNode
  feed: ReturnType<typeof useSessions>['feed']
  feedError: ReturnType<typeof useSessions>['feedError']
  selectedSessionId: string | null
  onOpenEvidence: (row: Extract<SessionFeedRow, { shape: 'tool' }>) => void
}

const SESSION_SPLIT = {
  inspector: '--size-session-inspector',
  inspectorMin: '--size-session-inspector-min',
  workspaceMin: '--size-session-workspace-min',
}

export function SessionScreenView() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [cockpit] = useProjects()
  const newSession = sessionId === 'new'
  const selectedSessionId = newSession ? null : (sessionId ?? null)
  const { feed, feedError, roster } = useSessions(selectedSessionId)
  const [newSessionCli, setNewSessionCli] = useState<SessionCli>('claude')
  const session = roster?.sessions.find(({ id }) => id === selectedSessionId) ?? null
  const [evidence, setEvidence] = useState<Extract<SessionFeedRow, { shape: 'tool' }> | null>(null)
  const cli: SessionCli = selectedSessionId === null ? newSessionCli : sessionCliOf(session)
  const composer = useSessionComposer({ cli, cockpit, navigate, roster, selectedSessionId })
  const permission = useClaudePermission(selectedSessionId)
  return (
    <SessionShell
      feed={feed}
      feedError={feedError}
      selectedSessionId={selectedSessionId}
      onOpenEvidence={setEvidence}
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
      inspector={evidence === null ? <SessionFacts session={session} /> : <EvidenceInspector evidence={evidence} />}
    />
  )
}

// The Roster stores an open `cli` string (ADR-0021: an adapter registers, shared code doesn't
// enumerate); this is the one seam that narrows it back to the closed `SessionCli` union.
function sessionCliOf(session: { cli: string } | null): SessionCli {
  return session?.cli === 'codex' ? 'codex' : 'claude'
}

export function SessionShell({
  composer,
  inspector,
  feed,
  feedError,
  selectedSessionId,
  onOpenEvidence,
}: SessionShellProps) {
  return (
    <main
      data-component="SessionShell"
      className="relative h-full min-h-0 overflow-hidden bg-background"
    >
      <InspectorSplit
        inspector={inspector}
        noun="Session"
        sizes={SESSION_SPLIT}
        workspace={
          <section aria-label="Session workspace" className="flex h-full min-h-0 flex-col">
            <header className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 bg-background px-(--spacing-shell-gutter)">
              <span className="flex-1" />
            </header>
            <section aria-label="Session feed" className="min-h-0 flex-1">
              <BasicFeed feed={feed} failure={feedError} selectedSessionId={selectedSessionId} onOpenEvidence={onOpenEvidence} />
            </section>
            <section aria-label="Session composer" className="shrink-0 border-t border-border/60">
              {composer}
            </section>
          </section>
        }
      />
    </main>
  )
}

function EvidenceInspector({ evidence }: { evidence: Extract<SessionFeedRow, { shape: 'tool' }> }) {
  if (evidence.evidence === null) return <section className="p-4 text-meta text-muted-foreground">Recorded evidence is unavailable.</section>
  return <section className="flex min-h-0 flex-1 flex-col" aria-label="Command and file inspector"><header className="sticky top-0 z-10 border-b border-border/60 bg-sidebar px-4 py-3 type-meta">{evidence.evidence.title}</header><pre className="min-h-0 overflow-auto p-4 type-code whitespace-pre-wrap">{evidence.evidence.source}</pre></section>
}

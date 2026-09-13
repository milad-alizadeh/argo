import { type ReactNode, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import { InspectorSplit } from '../../../components/InspectorSplit'
import { useProjects } from '../../projects/hooks/useProjects'
import { COMPOSER_FOCUS_STATE } from '../components/SessionComposer'
import { SessionEvidenceInspector } from '../components/SessionEvidenceInspector'
import { SessionComposerArea, SessionFacts } from '../components/SessionScreenDetails'
import { BasicFeed } from '../feed/BasicFeed'
import type { HarnessControl, SessionCli } from '../harness/harnesses'
import { useClaudePermission } from '../hooks/useClaudePermission'
import { useSessionComposer } from '../hooks/useSessionComposer'
import { useSessions } from '../hooks/useSessions'
import { useComposerStore } from '../state/useComposerStore'
import type { SessionFeedRow } from '../types'

type SessionShellProps = {
  composer: ReactNode
  inspector: ReactNode
  feed: ReturnType<typeof useSessions>['feed']
  feedError: ReturnType<typeof useSessions>['feedError']
  isRunning: boolean
  selectedSessionId: string | null
  activeEvidenceId: string | null
  onOpenEvidence: (row: Extract<SessionFeedRow, { shape: 'tool' }>) => void
}

const SESSION_SPLIT = {
  inspector: '--size-session-inspector',
  inspectorMin: '--size-session-inspector-min',
  workspaceMin: '--size-session-workspace-min',
}

export function SessionScreenView() {
  const { sessionId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [cockpit] = useProjects()
  const newSession = sessionId === 'new'
  const selectedSessionId = newSession ? null : (sessionId ?? null)
  const { feed, feedError, roster } = useSessions(selectedSessionId)
  const lastHarness = useComposerStore(({ harness }) => harness)
  const chooseHarness = useComposerStore(({ chooseHarness }) => chooseHarness)
  const session = roster?.sessions.find(({ id }) => id === selectedSessionId) ?? null
  const [evidence, setEvidence] = useState<Extract<SessionFeedRow, { shape: 'tool' }> | null>(null)
  const harness: HarnessControl =
    selectedSessionId === null
      ? { cli: lastHarness, onChange: chooseHarness }
      : { cli: sessionCliOf(session) }
  const cli = harness.cli
  const composer = useSessionComposer({
    cli,
    cockpit,
    focusOnMount: location.state === COMPOSER_FOCUS_STATE,
    navigate,
    roster,
    selectedSessionId,
  })
  const permission = useClaudePermission(selectedSessionId)
  return (
    <SessionShell
      feed={feed}
      feedError={feedError}
      isRunning={session?.status === 'running'}
      selectedSessionId={selectedSessionId}
      activeEvidenceId={evidence?.id ?? null}
      onOpenEvidence={setEvidence}
      composer={
        <SessionComposerArea
          composer={composer}
          permission={permission}
          session={session}
          harness={harness}
        />
      }
      inspector={
        evidence === null ? (
          <SessionFacts session={session} />
        ) : (
          <SessionEvidenceInspector evidence={evidence} />
        )
      }
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
  isRunning,
  selectedSessionId,
  activeEvidenceId,
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
              <BasicFeed
                activeEvidenceId={activeEvidenceId}
                feed={feed}
                failure={feedError}
                isRunning={isRunning}
                selectedSessionId={selectedSessionId}
                onOpenEvidence={onOpenEvidence}
              />
            </section>
            <section
              aria-label="Session composer"
              className="relative isolate shrink-0 bg-background"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-full h-(--size-session-composer-fade) bg-[image:var(--gradient-session-composer-fade)]"
              />
              {composer}
            </section>
          </section>
        }
      />
    </main>
  )
}

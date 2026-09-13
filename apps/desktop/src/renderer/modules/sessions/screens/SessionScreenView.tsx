import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'

import { InspectorSplit } from '../../../components/InspectorSplit'
import { useProjects } from '../../projects/hooks/useProjects'
import { SessionComposerArea, SessionFacts } from '../components/SessionScreenDetails'
import { BasicFeed } from '../feed/BasicFeed'
import type { HarnessControl, SessionCli } from '../harness/harnesses'
import { useClaudePermission } from '../hooks/useClaudePermission'
import { useSessionComposer } from '../hooks/useSessionComposer'
import { useSessions } from '../hooks/useSessions'
import { useComposerStore } from '../state/useComposerStore'

type SessionShellProps = {
  composer: ReactNode
  inspector: ReactNode
  feed: ReturnType<typeof useSessions>['feed']
  feedError: ReturnType<typeof useSessions>['feedError']
  selectedSessionId: string | null
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
  const lastHarness = useComposerStore(({ harness }) => harness)
  const chooseHarness = useComposerStore(({ chooseHarness }) => chooseHarness)
  const session = roster?.sessions.find(({ id }) => id === selectedSessionId) ?? null
  const harness: HarnessControl =
    selectedSessionId === null
      ? { cli: lastHarness, onChange: chooseHarness }
      : { cli: sessionCliOf(session) }
  const cli = harness.cli
  const composer = useSessionComposer({ cli, cockpit, navigate, roster, selectedSessionId })
  const permission = useClaudePermission(selectedSessionId)

  return (
    <SessionShell
      feed={feed}
      feedError={feedError}
      selectedSessionId={selectedSessionId}
      composer={
        <SessionComposerArea
          composer={composer}
          permission={permission}
          session={session}
          harness={harness}
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

export function SessionShell({
  composer,
  inspector,
  feed,
  feedError,
  selectedSessionId,
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
              <BasicFeed feed={feed} failure={feedError} selectedSessionId={selectedSessionId} />
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

import { GitBranchIcon, GitPullRequestIcon, PanelLeftIcon, PanelRightIcon } from 'lucide-react'

import type { Session } from '../types'

export function SessionDeckHead({
  session,
  showInspectorToggle,
  onShowRoster,
  onShowInspector,
}: {
  session: Session | null
  showInspectorToggle: boolean
  onShowRoster: () => void
  onShowInspector: () => void
}) {
  return (
    <header className="session-page__deck-head" data-component="SessionDeckHead">
      <button
        aria-label="Show Sessions"
        className="session-page__icon-button session-page__roster-toggle"
        data-component="RosterToggle"
        onClick={onShowRoster}
        type="button"
      >
        <PanelLeftIcon aria-hidden="true" />
      </button>
      {session === null ? <span className="flex-1" /> : <SessionIdentity session={session} />}
      {showInspectorToggle && session !== null ? (
        <button
          aria-label="Show inspector"
          className="session-page__icon-button"
          data-component="InspectorToggle"
          onClick={onShowInspector}
          type="button"
        >
          <PanelRightIcon aria-hidden="true" />
        </button>
      ) : null}
    </header>
  )
}

function SessionIdentity({ session }: { session: Session }) {
  return (
    <div className="session-page__identity">
      <h1>{session.title?.text ?? session.id}</h1>
      <div className="session-page__facts">
        {session.branch === null ? null : (
          <span>
            <GitBranchIcon aria-hidden="true" />
            {session.branch}
          </span>
        )}
        {session.pullRequest === null ? null : (
          <a href={session.pullRequest.url} rel="noreferrer" target="_blank">
            <GitPullRequestIcon aria-hidden="true" />#{session.pullRequest.number}
          </a>
        )}
      </div>
    </div>
  )
}

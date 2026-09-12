import { PlusIcon, SearchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Session, SessionId } from '../types'

import { ArchivedSessions } from './ArchivedSessions'
import { RosterBar } from './RosterBar'
import { RosterNotice } from './RosterNotice'
import { RosterSkeleton } from './RosterSkeleton'
import { SessionList } from './SessionList'

type SessionRosterProps = {
  sessions: readonly Session[]
  selectedSessionId: SessionId | null
  /** The last pass's failure, if it had one. The rows below it are the older pass's. */
  failure: string | null
  loading: boolean
  projectName: string
  onCollapse: () => void
  onSelect: (sessionId: SessionId) => void
  onReread: () => void
}

export function SessionRoster({
  sessions,
  selectedSessionId,
  failure,
  loading,
  projectName,
  onCollapse,
  onSelect,
  onReread,
}: SessionRosterProps) {
  const { t } = useTranslation()
  // Two lists off one reading: the Sessions a reader is working through, and the ones they put
  // away. The flag is the Claude desktop app's own, so a Session archived in that app is already
  // in the section below (`sessions/archive.ts`).
  const live = sessions.filter((session) => !session.archived)
  const archived = sessions.filter((session) => session.archived)
  const list = sessionList({
    loading,
    live,
    selectedSessionId,
    onSelect,
    label: t('navigationLabel'),
  })

  return (
    // The Roster pane (`roster-row-signals-prototype.html` · sidebar): a head the same height as
    // the deck's, the list, and the archive behind a Collapsible at its foot. The edge it shares
    // with the deck is the resize handle, so it draws no border of its own. Its ground is
    // shadcn's sidebar surface, like the deck's is shadcn's background, so both panes follow the
    // appearance the reader chose.
    <aside
      aria-label={t('navigationLabel')}
      className="flex h-full min-h-0 flex-col bg-card"
      data-component="SessionRoster"
    >
      <RosterBar onCollapse={onCollapse} projectName={projectName} />
      <header
        className="flex flex-none items-center gap-(--spacing-shell-tight) p-(--spacing-shell-gutter) pl-(--spacing-shell-inset)"
        data-component="SessionRosterHead"
      >
        <h2 className="flex-1 text-heading font-medium text-foreground">{t('title')}</h2>
        <button aria-label={t('newSession')} className="session-page__icon-button" type="button">
          <PlusIcon aria-hidden="true" />
        </button>
        <button aria-label={t('findSession')} className="session-page__icon-button" type="button">
          <SearchIcon aria-hidden="true" />
        </button>
      </header>
      {failure === null ? null : <RosterNotice failure={failure} onReread={onReread} />}
      {/* Positioned, so the visually hidden status words on its rows scroll and clip with the
          list rather than lining up against the window and making the page scroll. */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">{list}</div>
      <ArchivedSessions
        onSelect={onSelect}
        selectedSessionId={selectedSessionId}
        sessions={archived}
      />
    </aside>
  )
}

function sessionList({
  loading,
  live,
  selectedSessionId,
  onSelect,
  label,
}: {
  loading: boolean
  live: readonly Session[]
  selectedSessionId: SessionId | null
  onSelect: (sessionId: SessionId) => void
  label: string
}) {
  if (loading) {
    return (
      <div aria-busy="true" aria-label={label} data-component="SessionList" role="listbox">
        <RosterSkeleton />
      </div>
    )
  }
  if (live.length === 0) {
    return <div aria-label={label} data-component="SessionList" role="listbox" />
  }
  return <SessionList onSelect={onSelect} selectedSessionId={selectedSessionId} sessions={live} />
}

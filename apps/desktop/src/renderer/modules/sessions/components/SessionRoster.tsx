import { RefreshCwIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Session, SessionId } from '../types'

import { ArchivedSessions } from './ArchivedSessions'
import { SessionList } from './SessionList'
import { SessionsEmptyState } from './SessionsEmptyState'

type SessionRosterProps = {
  sessions: readonly Session[]
  selectedSessionId: SessionId | null
  /** The last pass's failure, if it had one. The rows below it are the older pass's. */
  failure: string | null
  onSelect: (sessionId: SessionId) => void
  onReread: () => void
}

export function SessionRoster({
  sessions,
  selectedSessionId,
  failure,
  onSelect,
  onReread,
}: SessionRosterProps) {
  const { t } = useTranslation()
  // Two lists off one reading: the Sessions a reader is working through, and the ones they put
  // away. The flag is the Claude desktop app's own, so a Session archived in that app is already
  // in the section below (`sessions/archive.ts`).
  const live = sessions.filter((session) => !session.archived)
  const archived = sessions.filter((session) => session.archived)

  return (
    // The Roster pane (`roster-row-signals-prototype.html` · sidebar): a head the same height as
    // the deck's, the list, and the archive behind a Collapsible at its foot. The edge it shares
    // with the deck is the resize handle, so it draws no border of its own. Its ground is
    // shadcn's sidebar surface, like the deck's is shadcn's background, so both panes follow the
    // appearance the reader chose.
    <aside className="flex h-full min-h-0 flex-col bg-sidebar">
      <header className="flex h-(--size-pane-head) flex-none items-center gap-2 px-snug">
        <h1 className="flex-1 text-eyebrow font-semibold uppercase tracking-[0.6px] text-faint">
          {t('title')}
        </h1>
        {/* Nothing watches the transcripts, so this reading is as old as the pass that made it
            and the reader is given the way to take another. It sits in the head because that is
            where what is true of the whole list belongs; the words are on the button for a
            screen reader rather than in the pane. */}
        <button
          aria-label={t('readAgain')}
          className="cockpit__reread flex-none rounded-(--radius-row) p-1 text-faint hover:bg-sidebar-accent hover:text-ink"
          onClick={onReread}
          type="button"
        >
          <RefreshCwIcon className="size-[13px]" />
        </button>
      </header>
      {failure === null ? null : (
        <p className="cockpit__failed flex-none px-snug pb-2 text-meta text-warn">{failure}</p>
      )}
      {/* Positioned, so the visually hidden status words on its rows scroll and clip with the
          list rather than lining up against the window and making the page scroll. */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        {live.length === 0 ? (
          <SessionsEmptyState
            description={t('empty.roster.description')}
            title={t('empty.roster.title')}
          />
        ) : (
          <SessionList onSelect={onSelect} selectedSessionId={selectedSessionId} sessions={live} />
        )}
      </div>
      <ArchivedSessions
        onSelect={onSelect}
        selectedSessionId={selectedSessionId}
        sessions={archived}
      />
    </aside>
  )
}

import { Inbox, RefreshCw } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { Button } from '../../../components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '../../../components/ui/empty'
import { useSessions } from '../hooks/useSessions'
import { sessionFailureState } from '../sessionFailureState'
import type { SessionError, SessionId, SessionsListed } from '../types'

function sessionName(session: { id: string; title: { text: string } | null }) {
  return session.title?.text ?? session.id
}

function rosterState(
  roster: SessionsListed | null,
  rosterError: SessionError | null,
  count: number,
) {
  if (rosterError !== null) return sessionFailureState(rosterError)
  if (roster === null) return 'loading'
  return count === 0 ? 'empty' : 'ready'
}

export type SessionsSidebarContentProps = {
  roster: SessionsListed | null
  rosterError: SessionError | null
  selectedSessionId: SessionId | null
  onReread: () => void
  onSelect: (sessionId: SessionId) => void
}

export function SessionsSidebarContent({
  roster,
  rosterError,
  selectedSessionId,
  onReread,
  onSelect,
}: SessionsSidebarContentProps) {
  const [focusedSessionId, setFocusedSessionId] = useState<SessionId | null>(null)
  const sessions = roster?.sessions ?? []
  const visible = sessions.filter((session) => !session.archived)
  const archived = sessions.filter((session) => session.archived)
  const tabStop = focusedSessionId ?? selectedSessionId ?? visible[0]?.id ?? null
  const state = rosterState(roster, rosterError, visible.length)

  const moveFocus = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (current === -1) return
    event.preventDefault()
    const nextByKey = {
      ArrowDown: Math.min(current + 1, buttons.length - 1),
      ArrowUp: Math.max(current - 1, 0),
      End: buttons.length - 1,
      Home: 0,
    }
    const next = nextByKey[event.key as keyof typeof nextByKey]
    buttons[next]?.focus()
  }

  const rows = (items: typeof sessions, label: string) => (
    <nav aria-label={label}>
      <ul className="flex flex-col gap-1 px-3" onKeyDown={moveFocus}>
        {items.map((session) => {
          const selected = session.id === selectedSessionId
          return (
            <li key={session.id}>
              <button
                aria-current={selected ? 'page' : undefined}
                className={`w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'bg-muted text-foreground' : ''}`}
                data-session-id={session.id}
                onClick={() => onSelect(session.id)}
                onFocus={() => setFocusedSessionId(session.id)}
                tabIndex={session.id === tabStop ? 0 : -1}
                type="button"
              >
                <span className="block truncate font-medium">{sessionName(session)}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {session.status}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )

  return (
    <aside
      aria-label="Sessions sidebar"
      className="flex h-full min-h-0 flex-col bg-sidebar"
      data-state={state}
    >
      <header className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 px-4">
        <h2 className="flex-1 text-sm font-medium">Sessions</h2>
        <Button aria-label="Read again" onClick={onReread} size="icon-sm" variant="ghost">
          <RefreshCw />
        </Button>
      </header>
      {rosterError ? (
        <p className="px-4 py-3 text-sm text-destructive" role="alert">
          {rosterError.message}
        </p>
      ) : null}
      {roster === null && rosterError === null ? (
        <p className="p-4 text-sm text-muted-foreground" role="status">
          Argo is reading this machine's Sessions.
        </p>
      ) : null}
      {roster !== null && visible.length === 0 ? (
        <Empty className="flex-none border-0 px-4 py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              {archived.length > 0 ? 'No active Sessions' : 'No Sessions found'}
            </EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto py-3">{rows(visible, 'Sessions')}</div>
      {archived.length > 0 ? (
        <details className="border-t border-border/60 py-3">
          <summary className="cursor-pointer px-4 text-sm">Archived {archived.length}</summary>
          <div className="pt-2">{rows(archived, 'Archived')}</div>
        </details>
      ) : null}
    </aside>
  )
}

export function SessionsSidebar() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { roster, rosterError, reread } = useSessions(null)
  return (
    <SessionsSidebarContent
      onReread={reread}
      onSelect={(selectedSessionId) => navigate(`/sessions/${selectedSessionId}`)}
      roster={roster}
      rosterError={rosterError}
      selectedSessionId={sessionId ?? null}
    />
  )
}

import { Inbox, Plus, Search, TriangleAlert } from 'lucide-react'
import { type KeyboardEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { currentSessionId } from '@/core/sessions/models'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '../../../components/ui/empty'
import { Skeleton } from '../../../components/ui/skeleton'
import { useSessions } from '../hooks/useSessions'
import { sessionFailureState } from '../sessionFailureState'
import type { SessionError, SessionId, SessionsListed } from '../types'
import { ArchivedSessions } from './ArchivedSessions'
import { SessionRosterItem } from './SessionRosterItem'

const SELECTED_SESSION_KEY = 'argo.selected-session-id'

function rosterState(
  roster: SessionsListed | null,
  rosterError: SessionError | null,
  count: number,
) {
  if (rosterError !== null) return sessionFailureState(rosterError)
  if (roster === null) return 'loading'
  return count === 0 ? 'empty' : 'ready'
}

function RosterLoading() {
  return (
    <div aria-label="Reading Sessions" className="space-y-4 px-5 py-4" role="status">
      {[0, 1, 2].map((index) => (
        <div key={index}>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}

function SessionsSidebarHeader({ onNew }: { onNew: () => void }) {
  return (
    <header className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 px-4">
      <h2 className="flex-1 text-sm font-medium">Sessions</h2>
      <div className="flex items-center gap-1">
        <Button aria-label="New Session" onClick={onNew} size="icon-sm" variant="ghost">
          <Plus />
        </Button>
        <Button
          aria-label="Find a Session"
          className="disabled:opacity-100"
          disabled
          size="icon-sm"
          variant="ghost"
        >
          <Search />
        </Button>
      </div>
    </header>
  )
}

export type SessionsSidebarContentProps = {
  onNew?: () => void
  roster: SessionsListed | null
  rosterError: SessionError | null
  selectedSessionId: SessionId | null
  onSelect: (sessionId: SessionId) => void
}

export function SessionsSidebarContent({
  roster,
  rosterError,
  selectedSessionId,
  onSelect,
  onNew = () => {},
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
          return (
            <SessionRosterItem
              key={session.id}
              onFocus={() => setFocusedSessionId(session.id)}
              onSelect={() => onSelect(session.id)}
              selected={session.id === selectedSessionId}
              session={session}
              tabIndex={session.id === tabStop ? 0 : -1}
            />
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
      <SessionsSidebarHeader onNew={onNew} />
      {rosterError ? (
        <Alert
          className="mx-3 mt-3 w-auto border-destructive/50 bg-destructive/10"
          variant="destructive"
        >
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Unable to load Sessions</AlertTitle>
          <AlertDescription>{rosterError.message}</AlertDescription>
        </Alert>
      ) : null}
      {roster === null && rosterError === null ? <RosterLoading /> : null}
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
      <ArchivedSessions archived={archived} rows={rows} selectedSessionId={selectedSessionId} />
    </aside>
  )
}

export function SessionsSidebar() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { roster, rosterError } = useSessions(null)
  useEffect(() => {
    if (sessionId !== undefined || roster === null || rosterError !== null) return
    const storedId = window.localStorage.getItem(SELECTED_SESSION_KEY)
    if (storedId === null) return
    const restoredId = currentSessionId(roster.sessions, storedId)
    if (restoredId === null) {
      window.localStorage.removeItem(SELECTED_SESSION_KEY)
      return
    }
    navigate(`/sessions/${restoredId}`, { replace: true })
  }, [navigate, roster, rosterError, sessionId])

  return (
    <SessionsSidebarContent
      onNew={() => navigate('/sessions/new')}
      onSelect={(selectedSessionId) => {
        window.localStorage.setItem(SELECTED_SESSION_KEY, selectedSessionId)
        navigate(`/sessions/${selectedSessionId}`)
      }}
      roster={roster}
      rosterError={rosterError}
      selectedSessionId={sessionId ?? null}
    />
  )
}

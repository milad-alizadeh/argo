import { Inbox, Plus, Search, TriangleAlert } from 'lucide-react'
import { type KeyboardEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '../../../components/ui/empty'
import { Skeleton } from '../../../components/ui/skeleton'
import { currentSessionId } from '@/core/sessions/models'
import { useSessions } from '../hooks/useSessions'
import { sessionFailureState } from '../sessionFailureState'
import type { Session, SessionError, SessionId, SessionsListed } from '../types'

const SELECTED_SESSION_KEY = 'argo.selected-session-id'

const STATUS_MARKS: Record<Session['status'], string> = {
  asking: 'bg-warn',
  ended: 'bg-danger',
  idle: 'bg-idle',
  permission: 'bg-warn',
  running: 'bg-active shadow-state-glow',
  starting: 'bg-active shadow-state-glow',
  stopped: 'bg-danger',
  unknown: 'bg-transparent shadow-state-outline',
}

function activitySummary(session: Session): string {
  if (session.activity === null) return session.status
  return [session.activity.tool, session.activity.target].filter(Boolean).join(' ')
}

function sessionMetadata(session: Session): string[] {
  const metadata = [session.cli]
  if (session.plan !== null) metadata.push(`${session.plan.completed}/${session.plan.total} steps`)
  if (session.delegations.length > 0) metadata.push(`${session.delegations.length} agents`)
  if (session.pullRequest !== null) metadata.push(`PR #${session.pullRequest.number}`)
  return metadata
}

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

function SessionsSidebarHeader() {
  return (
    <header className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 px-4">
      <h2 className="flex-1 text-sm font-medium">Sessions</h2>
      <div className="flex items-center gap-1">
        <Button
          aria-label="New Session"
          className="disabled:opacity-100"
          disabled
          size="icon-sm"
          variant="ghost"
        >
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
                <span className="flex items-start gap-tight">
                  <span
                    aria-label={session.status}
                    className={`mt-(--spacing-dot-inset) size-(--size-state-dot) shrink-0 rounded-full ${STATUS_MARKS[session.status]}`}
                    role="img"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{sessionName(session)}</span>
                    <span className="block truncate text-meta text-faint">
                      {activitySummary(session)}
                    </span>
                    <span className="block truncate font-mono text-meta text-faint">
                      {sessionMetadata(session).join(' · ')}
                    </span>
                  </span>
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
      <SessionsSidebarHeader />
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
      {archived.length > 0 ? (
        <details
          className="border-t border-border/60 py-3"
          open={archived.some((session) => session.id === selectedSessionId)}
        >
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

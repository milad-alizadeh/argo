import { Inbox, Plus, Search, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '../../../components/ui/empty'
import { Skeleton } from '../../../components/ui/skeleton'
import { sessionFailureState } from '../sessionFailureState'
import type { SessionError, SessionId, SessionsListed } from '../types'
import { ArchivedSessions } from './ArchivedSessions'
import { RenameDialog } from './RenameDialog'
import { SessionRosterList } from './SessionRosterList'
import { useRosterFocus } from './useRosterFocus'

function rosterState(
  roster: SessionsListed | null,
  rosterError: SessionError | null,
  count: number,
) {
  if (rosterError !== null) return sessionFailureState(rosterError.code)
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

function SidebarRows({
  onFocus,
  onRename,
  onSelect,
  renamedTitles,
  selectedSessionId,
  tabStop,
  visible,
}: {
  onFocus: (sessionId: SessionId) => void
  onRename: (session: SessionsListed['sessions'][number]) => void
  onSelect: (sessionId: SessionId) => void
  renamedTitles: Record<string, string>
  selectedSessionId: SessionId | null
  tabStop: SessionId | null
  visible: SessionsListed['sessions']
}) {
  const list = (items: SessionsListed['sessions'], label: string) => (
    <SessionRosterList
      items={items}
      label={label}
      onFocus={onFocus}
      onRename={onRename}
      onSelect={onSelect}
      renamedTitles={renamedTitles}
      selectedSessionId={selectedSessionId}
      tabStop={tabStop}
    />
  )
  return (
    <>
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-3">
        {list(visible, 'Sessions')}
      </div>
      <ArchivedSessions
        rows={list}
        selectedSessionId={selectedSessionId}
        visibleSessionIds={visible.map((session) => session.id)}
      />
    </>
  )
}

export type SessionsSidebarContentProps = {
  onNew?: () => void
  roster: SessionsListed | null
  rosterError: SessionError | null
  selectedSessionId: SessionId | null
  onSelect: (sessionId: SessionId) => void
  onRename?: (session: SessionsListed['sessions'][number], name: string) => Promise<string>
}

export function SessionsSidebarContent({
  roster,
  rosterError,
  selectedSessionId,
  onSelect,
  onNew = () => {},
  onRename = async (_session, name) => name,
}: SessionsSidebarContentProps) {
  const sidebar = useRef<HTMLElement>(null)
  const [renameTarget, setRenameTarget] = useState<SessionsListed['sessions'][number] | null>(null)
  const [renamedTitles, setRenamedTitles] = useState<Record<string, string>>({})
  const visible = roster?.sessions ?? []
  const { setFocusedSessionId, tabStop } = useRosterFocus(sidebar, visible, selectedSessionId)
  const state = rosterState(roster, rosterError, visible.length)
  const rosterRequestId = roster?.requestId

  useEffect(() => {
    setRenamedTitles((titles) => (rosterRequestId === null ? titles : {}))
  }, [rosterRequestId])

  return (
    <aside
      aria-label="Sessions sidebar"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-sidebar"
      data-state={state}
      ref={sidebar}
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
            <EmptyTitle>No Sessions found</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : null}
      <SidebarRows
        onFocus={setFocusedSessionId}
        onRename={setRenameTarget}
        onSelect={onSelect}
        renamedTitles={renamedTitles}
        selectedSessionId={selectedSessionId}
        tabStop={tabStop}
        visible={visible}
      />
      <RenameDialog
        onRename={async (session, name) => {
          const accepted = await onRename(session, name)
          setRenamedTitles((titles) => ({ ...titles, [session.id]: accepted }))
        }}
        session={renameTarget}
        setSession={setRenameTarget}
      />
    </aside>
  )
}

export { SessionsSidebar } from './SessionsSidebarContainer'

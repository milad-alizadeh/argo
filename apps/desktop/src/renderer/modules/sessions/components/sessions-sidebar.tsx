import { Inbox, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '../../../components/ui/empty'
import type { SessionError, SessionId, SessionsListed } from '../types'
import { ArchivedSessions } from './archived-sessions'
import { RenameDialog } from './rename-dialog'
import { SessionRosterList } from './session-roster-list'
import { RosterLoading, rosterState, SessionsSidebarHeader } from './sessions-sidebar-chrome'
import { useRosterFocus } from './use-roster-focus'

function filteredSessions(sessions: SessionsListed['sessions'], search: string) {
  const query = search.trim().toLocaleLowerCase()
  if (query === '') return sessions
  return sessions.filter((session) =>
    (session.title?.text ?? session.id).toLocaleLowerCase().includes(query),
  )
}

function SidebarRows({
  onFocus,
  onRename,
  onOpenTicket,
  onLinkTicket,
  onUnlinkTicket,
  onSelect,
  renamedTitles,
  selectedSessionId,
  tabStop,
  visible,
}: {
  onFocus: (sessionId: SessionId) => void
  onRename: (session: SessionsListed['sessions'][number]) => void
  onOpenTicket: (session: SessionsListed['sessions'][number]) => void
  onLinkTicket: (session: SessionsListed['sessions'][number]) => void
  onUnlinkTicket: (session: SessionsListed['sessions'][number]) => void
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
      onOpenTicket={onOpenTicket}
      onLinkTicket={onLinkTicket}
      onUnlinkTicket={onUnlinkTicket}
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
  onOpenTicket?: (session: SessionsListed['sessions'][number]) => void
  onLinkTicket?: (session: SessionsListed['sessions'][number]) => void
  onUnlinkTicket?: (session: SessionsListed['sessions'][number]) => void
}

export function SessionsSidebarContent({
  roster,
  rosterError,
  selectedSessionId,
  onSelect,
  onNew = () => {},
  onRename = async (_session, name) => name,
  onOpenTicket = () => {},
  onLinkTicket = () => {},
  onUnlinkTicket = () => {},
}: SessionsSidebarContentProps) {
  const sidebar = useRef<HTMLElement>(null)
  const [renameTarget, setRenameTarget] = useState<SessionsListed['sessions'][number] | null>(null)
  const [renamedTitles, setRenamedTitles] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const sessions = roster?.sessions ?? []
  const visible = filteredSessions(sessions, search)
  const { setFocusedSessionId, tabStop } = useRosterFocus(sidebar, visible, selectedSessionId)
  const state = rosterState(roster, rosterError, sessions.length)
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
      <SessionsSidebarHeader onNew={onNew} onSearch={setSearch} search={search} />
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
      {roster !== null && sessions.length === 0 ? (
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
        onOpenTicket={onOpenTicket}
        onLinkTicket={onLinkTicket}
        onUnlinkTicket={onUnlinkTicket}
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

export { SessionsSidebar } from './sessions-sidebar-container'

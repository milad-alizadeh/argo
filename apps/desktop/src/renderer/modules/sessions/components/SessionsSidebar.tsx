import { Inbox, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '../../../components/ui/empty'
import type { SessionError, SessionId, SessionsListed } from '../types'
import { BulkActionBar } from './BulkActionBar'
import { RenameDialog } from './RenameDialog'
import { RosterLoading, rosterState, SessionsSidebarHeader } from './SessionsSidebarChrome'
import { SidebarRows } from './SidebarRows'
import { useRosterFocus } from './useRosterFocus'
import { useRosterSelection } from './useRosterSelection'

function filteredSessions(sessions: SessionsListed['sessions'], search: string) {
  const query = search.trim().toLocaleLowerCase()
  if (query === '') return sessions
  return sessions.filter((session) =>
    (session.title?.text ?? session.id).toLocaleLowerCase().includes(query),
  )
}

function NoSessionsFound() {
  return (
    <Empty className="flex-none border-0 px-4 py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>No Sessions found</EmptyTitle>
      </EmptyHeader>
    </Empty>
  )
}

function RosterErrorAlert({ error }: { error: SessionError }) {
  return (
    <Alert
      className="mx-3 mt-3 w-auto border-destructive/50 bg-destructive/10"
      variant="destructive"
    >
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>Unable to load Sessions</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
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
  onArchiveSelected?: (sessionIds: SessionId[]) => void
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
  onArchiveSelected = () => {},
}: SessionsSidebarContentProps) {
  const sidebar = useRef<HTMLElement>(null)
  const [renameTarget, setRenameTarget] = useState<SessionsListed['sessions'][number] | null>(null)
  const [renamedTitles, setRenamedTitles] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const sessions = roster?.sessions ?? []
  const visible = filteredSessions(sessions, search)
  const visibleIds = useMemo(() => visible.map((session) => session.id), [visible])
  const selection = useRosterSelection(visibleIds)
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
      {rosterError ? <RosterErrorAlert error={rosterError} /> : null}
      {roster === null && rosterError === null ? <RosterLoading /> : null}
      {roster !== null && sessions.length === 0 ? <NoSessionsFound /> : null}
      <SidebarRows
        onFocus={setFocusedSessionId}
        onRename={setRenameTarget}
        onOpenTicket={onOpenTicket}
        onLinkTicket={onLinkTicket}
        onUnlinkTicket={onUnlinkTicket}
        onSelect={(sessionId) => {
          selection.clear()
          onSelect(sessionId)
        }}
        onToggleSelect={selection.toggle}
        renamedTitles={renamedTitles}
        selectedIds={selection.selectedIds}
        selectedSessionId={selectedSessionId}
        tabStop={tabStop}
        visible={visible}
      />
      {selection.selectedIds.size > 0 ? (
        <BulkActionBar
          onArchive={() => {
            onArchiveSelected([...selection.selectedIds])
            selection.clear()
          }}
          onClear={selection.clear}
          selectedCount={selection.selectedIds.size}
        />
      ) : null}
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

import { useRef, useState } from 'react'
import type { SessionError, SessionId, SessionRoster, SessionsListed } from '../../types'
import { RenameDialog } from './rename-dialog'
import { LoadingMoreFooter, RosterOutcome } from './roster-outcome'
import { SessionsSidebarHeader } from './sessions-sidebar-chrome'
import { SidebarRows } from './sidebar-rows'
import { useSidebarRoster } from './use-sidebar-roster'

export type SessionsSidebarContentProps = {
  hasMoreSessions?: boolean
  isFetchingMoreSessions?: boolean
  onFetchMoreSessions?: () => void
  onNew?: () => void
  roster: SessionRoster | null
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
  hasMoreSessions = false,
  isFetchingMoreSessions = false,
  onFetchMoreSessions = () => {},
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
  const sessions = useSidebarRoster({ roster, rosterError, selectedSessionId, sidebar })
  const { focus, selection } = sessions

  return (
    <aside
      aria-label="Sessions sidebar"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-sidebar"
      data-state={sessions.state}
      ref={sidebar}
    >
      <SessionsSidebarHeader
        onNew={onNew}
        onSearch={sessions.setSearch}
        onStatusChange={sessions.setStatus}
        search={sessions.search}
        status={sessions.status}
      />
      <RosterOutcome
        count={sessions.sessionCount}
        roster={roster}
        rosterError={rosterError}
        status={sessions.status}
      />
      <SidebarRows
        hasMoreSessions={hasMoreSessions}
        onArchive={(sessionId) => {
          const bulk = selection.selectedIds.has(sessionId)
          onArchiveSelected(bulk ? [...selection.selectedIds] : [sessionId])
          if (bulk) selection.clear()
        }}
        onFetchMoreSessions={onFetchMoreSessions}
        onFocus={focus.setFocusedSessionId}
        onLinkTicket={onLinkTicket}
        onOpenTicket={onOpenTicket}
        onRename={setRenameTarget}
        onSelect={(sessionId) => {
          selection.clear()
          onSelect(sessionId)
        }}
        onToggleSelect={selection.toggle}
        onUnlinkTicket={onUnlinkTicket}
        renamedTitles={sessions.renamedTitles}
        selectedIds={selection.selectedIds}
        selectedSessionId={selectedSessionId}
        showArchive={roster !== null}
        tabStop={focus.tabStop}
        visible={sessions.visible}
      />
      {isFetchingMoreSessions ? <LoadingMoreFooter /> : null}
      <RenameDialog
        onRename={async (session, name) =>
          sessions.rename(session.id, await onRename(session, name))
        }
        session={renameTarget}
        setSession={setRenameTarget}
      />
    </aside>
  )
}

export { SessionsSidebar } from './sessions-sidebar-container'

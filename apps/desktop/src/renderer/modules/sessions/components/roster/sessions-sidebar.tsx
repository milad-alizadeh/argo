import { Inbox, TriangleAlert } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '../../../../components/ui/empty'
import type { SessionError, SessionId, SessionRoster, SessionsListed } from '../../types'
import { RenameDialog } from './rename-dialog'
import { RosterLoading, rosterState, SessionsSidebarHeader } from './sessions-sidebar-chrome'
import { SidebarRows } from './sidebar-rows'
import { useRosterFocus } from './use-roster-focus'
import { useRosterSelection } from './use-roster-selection'

const NO_SESSIONS: SessionsListed['sessions'] = []
const NO_TITLES: Record<string, string> = {}

// The titles a rename shows, and the Sessions they were recorded against.
type RenamedTitles = {
  sessions: SessionsListed['sessions']
  titles: Record<string, string>
}

function filteredSessions(sessions: SessionsListed['sessions'], search: string) {
  const query = search.trim().toLocaleLowerCase()
  if (query === '') return sessions
  return sessions.filter((session) =>
    (session.title?.text ?? session.id).toLocaleLowerCase().includes(query),
  )
}

function NoSessionsFound() {
  const { t } = useTranslation('sessions')
  return (
    <Empty className="flex-none border-0 px-4 py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t('noSessionsFound')}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  )
}

function RosterErrorAlert({ error }: { error: SessionError }) {
  const { t } = useTranslation('sessions')
  return (
    <Alert
      className="mx-3 mt-3 w-auto border-destructive/50 bg-destructive/10"
      variant="destructive"
    >
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{t('unableToLoadSessions')}</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  )
}

export type SessionsSidebarContentProps = {
  hasMoreSessions?: boolean
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
  const [renamed, setRenamed] = useState<RenamedTitles | null>(null)
  const [search, setSearch] = useState('')
  const sessions = roster?.sessions ?? NO_SESSIONS
  // A renamed title is shown locally until a roster read carries the new one. A read that finds
  // nothing new hands back the same Sessions, so the override stands until something changes.
  const renamedTitles = renamed?.sessions === sessions ? renamed.titles : NO_TITLES
  const visible = filteredSessions(sessions, search)
  const visibleIds = useMemo(() => visible.map((session) => session.id), [visible])
  const selection = useRosterSelection(visibleIds, selectedSessionId)
  const { setFocusedSessionId, tabStop } = useRosterFocus(sidebar, visible, selectedSessionId)
  const state = rosterState(roster, rosterError, sessions.length)

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
        hasMoreSessions={hasMoreSessions}
        onArchive={(sessionId) => {
          const bulk = selection.selectedIds.has(sessionId)
          onArchiveSelected(bulk ? [...selection.selectedIds] : [sessionId])
          if (bulk) selection.clear()
        }}
        onFetchMoreSessions={onFetchMoreSessions}
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
        showArchive={roster !== null}
        tabStop={tabStop}
        visible={visible}
      />
      <RenameDialog
        onRename={async (session, name) => {
          const accepted = await onRename(session, name)
          setRenamed({ sessions, titles: { ...renamedTitles, [session.id]: accepted } })
        }}
        session={renameTarget}
        setSession={setRenameTarget}
      />
    </aside>
  )
}

export { SessionsSidebar } from './sessions-sidebar-container'

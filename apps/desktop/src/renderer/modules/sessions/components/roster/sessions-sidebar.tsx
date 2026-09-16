import { Inbox, TriangleAlert } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '../../../../components/ui/empty'
import {
  showsActive,
  useRosterFilterStore,
  useRosterStatus,
} from '../../state/use-roster-filter-store'
import type { SessionError, SessionId, SessionRoster, SessionsListed } from '../../types'
import { RenameDialog } from './rename-dialog'
import {
  RosterLoading,
  RosterStatusRow,
  rosterState,
  SessionsSidebarHeader,
} from './sessions-sidebar-chrome'
import { SidebarRows } from './sidebar-rows'
import { useRosterFocus } from './use-roster-focus'
import { useRosterSelection } from './use-roster-selection'

const NO_SESSIONS: SessionsListed['sessions'] = []
const NO_TITLES: Record<string, string> = {}

// A renamed title is shown locally, keyed by session id, until a roster read carries the same
// title back through the transcript. Keying on the roster array's identity instead let a poll
// that changed nothing else revert the row, because `keepRosterOrder` builds a new array on every
// poll whether or not any Session actually changed (#2290).
function pendingRenames(renamed: Record<string, string>, sessions: SessionsListed['sessions']) {
  const pending: Record<string, string> = {}
  for (const [sessionId, title] of Object.entries(renamed)) {
    const landed = sessions.find((session) => session.id === sessionId)
    if (landed === undefined || landed.title?.text !== title) pending[sessionId] = title
  }
  return pending
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

// The wider window is read outside the scrolled list rather than as its last row: a row appended
// below the sentinel lands under the fold at the exact moment the reader reaches the bottom and
// asks for it, so the spinner was drawn and never seen.
function LoadingMoreFooter() {
  const { t } = useTranslation('sessions')
  return (
    <div className="shrink-0 border-t border-border/60">
      <RosterStatusRow label={t('loadingMoreSessions')} />
    </div>
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
  const [renamed, setRenamed] = useState<Record<string, string>>(NO_TITLES)
  const [search, setSearch] = useState('')
  const status = useRosterStatus()
  const setStatus = useRosterFilterStore((state) => state.setStatus)
  const sessions = roster?.sessions ?? NO_SESSIONS
  const renamedTitles = useMemo(() => pendingRenames(renamed, sessions), [renamed, sessions])
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
      <SessionsSidebarHeader
        onNew={onNew}
        onSearch={setSearch}
        onStatusChange={setStatus}
        search={search}
        status={status}
      />
      {rosterError ? <RosterErrorAlert error={rosterError} /> : null}
      {roster === null && rosterError === null ? <RosterLoading /> : null}
      {/* Under a filter that excludes the active roster its emptiness says nothing, so the Archive's
          own empty row speaks instead. */}
      {roster !== null && showsActive(status) && sessions.length === 0 ? <NoSessionsFound /> : null}
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
      {isFetchingMoreSessions ? <LoadingMoreFooter /> : null}
      <RenameDialog
        onRename={async (session, name) => {
          const accepted = await onRename(session, name)
          setRenamed((current) => ({ ...current, [session.id]: accepted }))
        }}
        session={renameTarget}
        setSession={setRenameTarget}
      />
    </aside>
  )
}

export { SessionsSidebar } from './sessions-sidebar-container'

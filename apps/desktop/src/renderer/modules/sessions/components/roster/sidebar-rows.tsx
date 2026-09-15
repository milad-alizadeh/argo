import type { SelectionModifier } from '../../state/roster-selection'
import { EMPTY_ROSTER_SELECTION } from '../../state/roster-selection'
import type { SessionId, SessionsListed } from '../../types'
import { ArchivedSessions } from './archived-sessions'
import { SessionRosterList } from './session-roster-list'

export function SidebarRows({
  onFocus,
  onRename,
  onOpenTicket,
  onLinkTicket,
  onUnlinkTicket,
  onSelect,
  onToggleSelect,
  renamedTitles,
  selectedIds,
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
  onToggleSelect: (sessionId: SessionId, modifier: SelectionModifier) => void
  renamedTitles: Record<string, string>
  selectedIds: ReadonlySet<SessionId>
  selectedSessionId: SessionId | null
  tabStop: SessionId | null
  visible: SessionsListed['sessions']
}) {
  const rosterList = (
    items: SessionsListed['sessions'],
    label: string,
    selection: { selectable: boolean; onToggleSelect: typeof onToggleSelect },
  ) => (
    <SessionRosterList
      items={items}
      label={label}
      onFocus={onFocus}
      onRename={onRename}
      onOpenTicket={onOpenTicket}
      onLinkTicket={onLinkTicket}
      onUnlinkTicket={onUnlinkTicket}
      onSelect={onSelect}
      onToggleSelect={selection.onToggleSelect}
      renamedTitles={renamedTitles}
      selectable={selection.selectable}
      selectedIds={selection.selectable ? selectedIds : EMPTY_ROSTER_SELECTION.ids}
      selectedSessionId={selectedSessionId}
      tabStop={tabStop}
    />
  )
  const activeList = (items: SessionsListed['sessions'], label: string) =>
    rosterList(items, label, { selectable: true, onToggleSelect })
  // The Archived section stays the read-only recovery path (#1593): it never grows a checkbox,
  // so it takes the same row component with selection wired off rather than a second one.
  const archivedList = (items: SessionsListed['sessions'], label: string) =>
    rosterList(items, label, { selectable: false, onToggleSelect: () => {} })
  return (
    <>
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-3">
        {activeList(visible, 'Sessions')}
      </div>
      <ArchivedSessions
        rows={archivedList}
        selectedSessionId={selectedSessionId}
        visibleSessionIds={visible.map((session) => session.id)}
      />
    </>
  )
}

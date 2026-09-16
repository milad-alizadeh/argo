import type { SessionId } from '../../types'
import { ArchivedSectionRow, ArchivedToggleRow } from './archived-status-row'
import type { RosterRow, RosterRowHandlers } from './roster-rows'
import { SessionRosterItem } from './session-roster-item'

export function RosterRowView({
  archivedLabel,
  onArchive,
  onFocus,
  onLinkTicket,
  onOpenTicket,
  onRename,
  onSelect,
  onToggleArchived,
  onToggleSelect,
  onUnlinkTicket,
  renamedTitles,
  row,
  selectedIds,
  selectedSessionId,
  tabStop,
}: RosterRowHandlers & {
  archivedLabel: string
  renamedTitles: Record<string, string>
  row: RosterRow
  selectedIds: ReadonlySet<SessionId>
  selectedSessionId: SessionId | null
  tabStop: SessionId | null
}) {
  switch (row.kind) {
    case 'archivedToggle':
      return (
        <ArchivedToggleRow
          archivedLabel={archivedLabel}
          onToggle={onToggleArchived}
          open={row.open}
        />
      )
    case 'archivedSentinel':
    case 'rosterSentinel':
      return <div aria-hidden="true" />
    case 'archivedLoading':
    case 'archivedError':
    case 'archivedEmpty':
    case 'archivedLoadingMore':
      return <ArchivedSectionRow row={row} />
    case 'session':
      break
  }

  const session = row.session
  const title = renamedTitles[session.id]
  const renamed =
    title === undefined
      ? session
      : { ...session, title: { text: title, source: 'custom' as const } }
  const selectable = !row.archived
  return (
    <SessionRosterItem
      archived={row.archived}
      checked={selectable && selectedIds.has(session.id)}
      onArchive={selectable ? () => onArchive(session.id) : undefined}
      onFocus={() => onFocus(session.id)}
      onLinkTicket={() => onLinkTicket(renamed)}
      onOpenTicket={() => onOpenTicket(renamed)}
      onRename={() => onRename(renamed)}
      onSelect={() => onSelect(session.id)}
      onToggleSelect={(modifier) => onToggleSelect(session.id, modifier)}
      onUnlinkTicket={() => onUnlinkTicket(renamed)}
      selectable={selectable}
      selected={session.id === selectedSessionId}
      session={renamed}
      tabIndex={session.id === tabStop ? 0 : -1}
    />
  )
}

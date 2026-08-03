import { cn } from '@/lib/utils'
import { Text } from '@/shared/components/ui'
import { ROOMS, type Room } from '../../shellModel'

// The visible half of each room: its word and the chord that reaches it. Keyed off `Room` so a
// room added to `ROOMS` and forgotten here is a compile error rather than a blank tab.
const ROOM_ENTRIES: Record<Room, { label: string; shortcut: string }> = {
  sessions: { label: 'Sessions', shortcut: '⌘1' },
  work: { label: 'Work', shortcut: '⌘2' },
  code: { label: 'Code', shortcut: '⌘3' },
}

const ENTRY_BASE =
  'flex cursor-pointer items-center gap-gap rounded-md px-inset py-gap text-muted-foreground transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

/**
 * Molecule: where you are, and how to get to the other two rooms.
 *
 * A router rather than a tab set — the rooms are destinations, not panes of one view — so it is
 * a `nav` of buttons carrying `aria-current`, and it draws no track behind them: the bar is not
 * a surface, and only the room you are in takes any ink.
 */
export function RoomSwitcher({
  room,
  onSelectRoom,
}: {
  /** Which room the stage is showing. */
  room: Room
  /** Go to a room. Sessions is the launch default; the other two are entered deliberately. */
  onSelectRoom: (room: Room) => void
}): React.JSX.Element {
  return (
    <nav aria-label="Rooms" data-component="RoomSwitcher" className="flex items-center gap-hair">
      {ROOMS.map((candidate) => {
        const current = candidate === room
        return (
          <button
            key={candidate}
            type="button"
            aria-current={current ? 'page' : undefined}
            onClick={() => onSelectRoom(candidate)}
            className={cn(ENTRY_BASE, current && 'bg-secondary text-foreground-bright')}
          >
            <Text variant="row">{ROOM_ENTRIES[candidate].label}</Text>
            <Text variant="meta" className={cn('text-foreground-faint', current && 'text-primary')}>
              {ROOM_ENTRIES[candidate].shortcut}
            </Text>
          </button>
        )
      })}
    </nav>
  )
}

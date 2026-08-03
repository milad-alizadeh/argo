import type { ReactNode } from 'react'
import type { Room } from '../../shellModel'
import { ConciergeStrip } from './ConciergeStrip'
import { RoomSwitcher } from './RoomSwitcher'
import { WindowControls } from './WindowControls'

type TopBarProps = {
  /** Which room the stage is showing. */
  room: Room
  /** What the Concierge is saying, or `null` when it is silent. */
  caption: string | null
  /** The active project's connection roll-up. Placed FIRST in the right cluster: the cluster is
   * right-aligned, so a chip waking up at its start grows into empty space instead of shoving
   * the room tabs sideways. Silent when every binding is healthy. */
  connectionChip?: ReactNode
  /** The global git / checkout group, meaning the project's primary checkout in every room.
   * Absent when the project folder is not a git repository — the group hides whole. */
  gitControls?: ReactNode
  /** Go to a room. */
  onSelectRoom: (room: Room) => void
}

/**
 * Organism: the one merged floating bar, present in all three rooms.
 *
 * It is not a surface: no fill, no divider line, and no reserved band pushing the room's content
 * down — it floats on the lit scene. Left to right: the traffic-light clearance, the Concierge's
 * seat, then a right-aligned cluster of connection chip, room tabs and git group. It deliberately
 * carries no wordmark, no project label and no `⌘K` button; the strip and the window carry
 * project identity, and the palette is discovered once rather than advertised forever.
 */
export function TopBar({
  room,
  caption,
  connectionChip,
  gitControls,
  onSelectRoom,
}: TopBarProps): React.JSX.Element {
  return (
    <header
      data-component="TopBar"
      className="flex min-h-traffic-lights w-full shrink-0 items-center gap-region pr-plane"
      // Chromium's drag property is the only way a frameless (`hiddenInset`) window can still be
      // moved, and Tailwind has no utility for it — design-system.md escape hatch 2.
      style={{ WebkitAppRegion: 'drag' }}
    >
      <WindowControls />
      <ConciergeStrip caption={caption} />
      <div
        className="ml-auto flex items-center gap-region"
        // Controls inside a drag region never receive their clicks unless they opt back out.
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        {connectionChip}
        <RoomSwitcher room={room} onSelectRoom={onSelectRoom} />
        {gitControls}
      </div>
    </header>
  )
}

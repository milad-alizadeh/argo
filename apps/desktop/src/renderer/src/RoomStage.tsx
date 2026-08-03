import type { ReactNode } from 'react'
import { Text } from '@/shared/components/ui'
import type { Room } from '@/shell/components'

/**
 * The stage under the chrome: whichever room `⌘1`/`⌘2`/`⌘3` selected.
 *
 * Work and Code are honestly empty until their own tickets build them. The shell renders the
 * switch because the keymap and the room tabs are this ticket's; it does not fake a room's
 * content, and these two arms are scaffolding those tickets delete.
 */
export function RoomStage({
  room,
  sessions,
}: {
  room: Room
  /** The Sessions room's own screen, passed in so the stage stays a pure switch. */
  sessions: ReactNode
}): React.JSX.Element {
  switch (room) {
    case 'sessions':
      return <>{sessions}</>
    case 'work':
      return <UnbuiltRoom name="Work room" />
    case 'code':
      return <UnbuiltRoom name="Code room" />
    default: {
      const unreachable: never = room
      return unreachable
    }
  }
}

function UnbuiltRoom({ name }: { name: string }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-tight">
      <Text as="p" variant="title" className="text-foreground-soft">
        Nothing here yet.
      </Text>
      <Text as="p" variant="meta" className="text-foreground-faint">
        The {name} is still being built.
      </Text>
    </div>
  )
}

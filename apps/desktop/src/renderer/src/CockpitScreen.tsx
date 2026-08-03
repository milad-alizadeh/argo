import type { ReactNode } from 'react'
import {
  EmptyShell,
  GitControls,
  type GitControlsProps,
  ProjectStrip,
  type Room,
  type ShellModel,
  TopBar,
} from '@/shell/components'

// The renderer root: the chrome plus whichever room is showing. Composition lives here, outside
// every slice, because the shell is a PEER of the rooms rather than their parent — the shell
// reaches into no room and no room reaches into the shell.

/** Everything the chrome raises, gathered so the container wires it once. */
export interface CockpitHandlers {
  onSelectProject: (projectId: string) => void
  onAddProject: () => void
  onOpenProjectMenu: (projectId: string) => void
  onSelectRoom: (room: Room) => void
  /** Hand off to onboarding from the empty shell. */
  onConnect: () => void
}

export interface CockpitScreenProps {
  shell: ShellModel
  room: Room
  /** What the Concierge is saying. A seat only in v1: behaviour belongs to the voice map. */
  caption: string | null
  /** How long ago the active project last synced, for its tab tooltip. */
  lastSynced: string | null
  git: GitControlsProps
  handlers: CockpitHandlers
  /** The active room's stage. Replaced by the connect seam while nothing is connected. */
  children: ReactNode
}

export function CockpitScreen({
  shell,
  room,
  caption,
  lastSynced,
  git,
  handlers,
  children,
}: CockpitScreenProps): React.JSX.Element {
  return (
    // No background of its own: the chrome floats on the ONE lit scene the room paints behind
    // it (a fixed `-z-10` backdrop), and an opaque shell root would cover it.
    <div className="flex h-screen w-screen overflow-hidden">
      <ProjectStrip
        tabs={shell.tabs}
        lastSynced={lastSynced}
        onSelectProject={handlers.onSelectProject}
        onAddProject={handlers.onAddProject}
        onOpenProjectMenu={handlers.onOpenProjectMenu}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          room={room}
          caption={caption}
          gitControls={<GitControls {...git} />}
          onSelectRoom={handlers.onSelectRoom}
        />
        <main className="flex min-h-0 flex-1 flex-col">
          {shell.connected ? children : <EmptyShell onConnect={handlers.onConnect} />}
        </main>
      </div>
    </div>
  )
}

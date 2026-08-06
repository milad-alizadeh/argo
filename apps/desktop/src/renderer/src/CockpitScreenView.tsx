import type { ReactNode } from 'react'
import {
  ConnectPanel,
  type ConnectPanelHandlers,
  type ConnectPanelModel,
  EmptyShell,
  GitControls,
  type GitControlsProps,
  ProjectStrip,
  type Room,
  RoomScene,
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
  onSelectRoom: (room: Room) => void
  /** Hand off to onboarding from the empty shell. */
  onConnect: () => void
  /** Open Project Settings on one project, from its tab's context menu. */
  onOpenSettings: (projectId: string) => void
}

export interface CockpitScreenProps {
  shell: ShellModel
  room: Room
  /** What the Concierge is saying. A seat only in v1: behaviour belongs to the voice map. */
  caption: string | null
  git: GitControlsProps
  /** Onboarding, or Project Settings re-opened — one surface (#265). `null` when neither is
   * open, which is every moment the user is actually working. */
  connect: ConnectPanelModel | null
  connectHandlers: ConnectPanelHandlers
  handlers: CockpitHandlers
  /** The active room's stage. Replaced by the connect seam while nothing is connected. */
  children: ReactNode
}

export function CockpitScreenView({
  shell,
  room,
  caption,
  git,
  connect,
  connectHandlers,
  handlers,
  children,
}: CockpitScreenProps): React.JSX.Element {
  return (
    // No background of its own: the chrome floats on the ONE lit scene `RoomScene` paints behind
    // it as a fixed `-z-10` backdrop, and an opaque shell root would cover it. The SHELL paints
    // it, not each room: the light does not change when you change rooms, and while nothing
    // painted it at all every plane's cove lip and warm bloom implied a source that was not there.
    <div className="flex h-screen w-screen overflow-hidden">
      <RoomScene />
      <ProjectStrip
        tabs={shell.tabs}
        onSelectProject={handlers.onSelectProject}
        onAddProject={handlers.onAddProject}
        onOpenSettings={handlers.onOpenSettings}
      />
      {/* The bar RESERVES NO BAND: it is absolutely positioned over the stage rather than
          stacked above it, so the room's content runs the full height and the bar floats on
          the scene. That is what "it is not a surface" means geometrically. */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="absolute inset-x-0 top-0 z-20">
          <TopBar
            room={room}
            caption={caption}
            gitControls={<GitControls {...git} />}
            onSelectRoom={handlers.onSelectRoom}
          />
        </div>
        {/* The stage insets its own top so the room's content clears the floating chrome, which
            is how the prototypes measure it (the Code room's rail starts below the brow). The
            BAR still reserves nothing: it has no fill, no divider and no place in the flow, and
            the lit scene runs full-bleed behind all of it. */}
        <main className="flex min-h-0 flex-1 flex-col pt-traffic-lights">
          <Stage
            connect={connect}
            connectHandlers={connectHandlers}
            connected={shell.connected}
            onConnect={handlers.onConnect}
          >
            {children}
          </Stage>
        </main>
      </div>
    </div>
  )
}

/**
 * What the stage is showing: onboarding, the active room, or the honest empty seam.
 *
 * The connect panel takes the whole stage rather than floating over it, because onboarding IS
 * creating a Project (ADR-0015): while it is open there is no project world behind it to keep
 * visible, and Project Settings is that same surface re-entered.
 */
function Stage({
  connect,
  connectHandlers,
  connected,
  onConnect,
  children,
}: {
  connect: ConnectPanelModel | null
  connectHandlers: ConnectPanelHandlers
  connected: boolean
  onConnect: () => void
  children: ReactNode
}): React.JSX.Element {
  if (connect !== null) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-region">
        <ConnectPanel panel={connect} handlers={connectHandlers} />
      </div>
    )
  }
  if (!connected) return <EmptyShell onConnect={onConnect} />
  return <>{children}</>
}

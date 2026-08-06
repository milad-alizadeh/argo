import { PanelSplitter, type TerminalAttach } from '@/shared/components/ui'
import type { SessionInteriorModel } from '../interior/model'
import type { SessionsRoomModel } from '../roster/model'
import { Roster } from './Roster'
import { SessionPlane, type SessionPlaneHandlers } from './SessionPlane'
import { SPINE, type SpineEdge, type SpineLayout } from './useSpineLayout'

/** Every callback the room's regions raise, gathered so the container wires them once. */
export interface SessionScreenHandlers extends SessionPlaneHandlers {
  onSelectSession: (id: string) => void
  /** Spawn a session in the active project — the visible half of `⌘N`. */
  onSpawnSession: () => void
  onResize: (edge: SpineEdge, px: number) => void
}

/**
 * Screen (pure View): the Sessions room — the roster rail beside the open session's plane.
 *
 * Props in, JSX out; the container owns the state and the derivation. The screen-local layout px
 * live only in the root's inline custom properties (`--c-rail`/`--c-act`/`--r-dock`) and the regions
 * size off them, never off a token. With nothing selected the rail stands alone on the room's lit
 * scene, which is what the zero-state and a fresh cockpit both look like.
 */
export function SessionScreen({
  roster,
  interior,
  layout,
  attach,
  handlers,
  spawnRefusal = null,
}: {
  /** The roster rail's derived view-model — the room's left column. */
  roster: SessionsRoomModel
  /** Why the last spawn did not happen, verbatim; `null` when none refused. */
  spawnRefusal?: string | null
  /** The open session's interior, or `null` when nothing is selected. */
  interior: SessionInteriorModel | null
  /** The three splitter-driven px sizes the custom properties carry. */
  layout: SpineLayout
  /** Reaches the open session's PTY, for the Dock. */
  attach?: TerminalAttach
  handlers: SessionScreenHandlers
}): React.JSX.Element {
  return (
    <main
      data-testid="cockpit-root"
      style={{
        '--c-rail': `${layout.roster}px`,
        '--r-dock': `${layout.dock}px`,
      }}
      className="flex min-h-0 min-w-0 flex-1 p-inset text-foreground"
    >
      {/* The rail sits OUTSIDE the glass: its rows are planes floating in the room's lit scene, and a
          frosted panel behind them would be glass on glass. The session plane keeps the one frosted
          surface, so closing a session leaves the rail alone on the scene. */}
      <Roster
        model={roster}
        onSelectSession={handlers.onSelectSession}
        onSpawnSession={handlers.onSpawnSession}
        spawnRefusal={spawnRefusal}
      />
      {interior && (
        <>
          {/* Held off the plane's corners. This splitter runs alongside a 16px-rounded card, and a
              full-height hairline kept going straight past both corners while the plane's own edge
              had already curved away — a line sticking out of the card at each end. Inset by the
              radius it spans exactly the plane's straight edge. The 32px it gives up is hit target
              on an ~875px column, and the arrow keys resize it regardless. */}
          <PanelSplitter
            orientation="v"
            label="Roster width"
            size={layout.roster}
            min={SPINE.roster.min}
            max={SPINE.roster.max}
            onResize={(px) => handlers.onResize('roster', px)}
            className="my-plane-corner"
          />
          <SessionPlane interior={interior} layout={layout} attach={attach} handlers={handlers} />
        </>
      )}
    </main>
  )
}

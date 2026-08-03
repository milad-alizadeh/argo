import type { SessionView } from '@shared'
import { useEffect, useMemo, useState } from 'react'
import {
  buildSessionInterior,
  DEFAULT_INTERIOR_UI,
  type InteriorUiState,
  isDockExpanded,
  type SessionInteriorModel,
  type SessionScreenHandlers,
  type SpineLayout,
  useSpineLayout,
} from '@/rooms/sessions/components'
import type { TerminalAttach } from '@/shared/components/ui'

// The Sessions room's own UI state, held apart from the shell's: which room a project is showing is
// the shell's business, and what the open session's interior is doing is the room's.

/** ONE session's PTY, from the preload bridge. `undefined` outside the app (Storybook, a plain
 * browser preview) leaves the Dock's pane inert rather than faking a shell.
 *
 * Bound to the session here rather than in the pane: the pane must not know the bridge, and the
 * identity is what re-attaches it — a Dock handed a new function tears its old shell down and opens
 * the one belonging to the session now on screen. */
function useTerminalAttach(sessionId: string | null): TerminalAttach | undefined {
  return useMemo(() => {
    const bridge = window.cockpit
    if (bridge === undefined || sessionId === null) return undefined
    return (size, onChunk) => bridge.openTerminal(sessionId, size, onChunk)
  }, [sessionId])
}

// The header's `idle 5m` is arithmetic against the wall clock, so a clock read during render freezes
// the moment the last unrelated state change happened. Half a minute is the resolution the segment
// shows: it counts whole minutes, so a faster tick would re-render for a number that cannot move.
const TICK_MS = 30_000

function useWallClock(active: boolean): number | null {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNowMs(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [active])
  return active ? nowMs : null
}

export interface SessionInterior {
  interior: SessionInteriorModel | null
  layout: SpineLayout
  attach?: TerminalAttach
  handlers: Omit<SessionScreenHandlers, 'onSelectSession' | 'onSpawnSession'>
}

export function useSessionInterior(selected: SessionView | null): SessionInterior {
  const [ui, setUi] = useState<InteriorUiState>(DEFAULT_INTERIOR_UI)
  const { layout, resize, snapDock } = useSpineLayout()
  const nowMs = useWallClock(selected !== null)
  const attach = useTerminalAttach(selected?.id ?? null)

  return {
    // The link facts (how the title resolved, the ticket, the mode) are not observed yet, so the
    // interior takes its honest defaults and degrades those segments away.
    interior: selected ? buildSessionInterior({ session: selected, ui, nowMs }) : null,
    layout,
    attach,
    handlers: {
      onResize: resize,
      onResizeDock: (px) => resize('dock', px),
      onResizeActivity: (px) => resize('activity', px),
      onToggleDock: () => snapDock(!isDockExpanded(layout.dock)),
      onSelectTab: (tab) => setUi((state) => ({ ...state, tab })),
    },
  }
}

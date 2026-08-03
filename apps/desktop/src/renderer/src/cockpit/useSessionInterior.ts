import type { SessionView } from '@shared'
import { useState } from 'react'
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

/** The session's PTY, from the preload bridge. `undefined` outside the app (Storybook, a plain
 * browser preview) leaves the Dock's pane inert rather than faking a shell. */
const terminalAttach = (): TerminalAttach | undefined => window.cockpit?.openTerminal

export interface SessionInterior {
  interior: SessionInteriorModel | null
  layout: SpineLayout
  attach?: TerminalAttach
  handlers: Omit<SessionScreenHandlers, 'onSelectSession' | 'onSpawnSession'>
}

export function useSessionInterior(selected: SessionView | null): SessionInterior {
  const [ui, setUi] = useState<InteriorUiState>(DEFAULT_INTERIOR_UI)
  const { layout, resize, snapDock } = useSpineLayout()

  return {
    // The link facts (how the title resolved, the ticket, the mode) are not observed yet, so the
    // interior takes its honest defaults and degrades those segments away.
    interior: selected ? buildSessionInterior({ session: selected, ui, nowMs: Date.now() }) : null,
    layout,
    attach: terminalAttach(),
    handlers: {
      onResize: resize,
      onResizeDock: (px) => resize('dock', px),
      onResizeActivity: (px) => resize('activity', px),
      onToggleDock: () => snapDock(!isDockExpanded(layout.dock)),
      onSelectTab: (tab) => setUi((state) => ({ ...state, tab })),
    },
  }
}

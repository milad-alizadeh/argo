import type { SessionView } from '@shared'
import { useState } from 'react'
import { LIVE_CHANNEL_ID } from '@/domains/console/components'
import { isConsoleExpanded, type SpineLayout, useSpineLayout } from '@/rooms/sessions/components'
import type { SessionScreenHandlers } from '@/SessionScreen'
import { buildSessionPanel, type PanelUiState } from '@/sessionScreenModel'

// The Sessions room's own UI state, held apart from the shell's: the room a project is showing
// is the shell's business, and what the open session's panels are doing is the room's.

// The screen opens with the Delivery region showing, no drawer or capture open, the Changes
// tab flat, and the console at its short height on the live channel.
const DEFAULT_PANEL_UI: PanelUiState = {
  variant: 'split',
  openNode: null,
  tab: 'changes',
  changesView: 'all',
  activeChannel: LIVE_CHANNEL_ID,
}

export interface SessionPanel {
  panel: ReturnType<typeof buildSessionPanel> | null
  layout: SpineLayout
  handlers: Omit<SessionScreenHandlers, 'onSelectSession' | 'onCloseSession' | 'onSpawnSession'>
}

export function useSessionPanel(selected: SessionView | null): SessionPanel {
  const [ui, setUi] = useState<PanelUiState>(DEFAULT_PANEL_UI)
  const { layout, resize, snapConsole } = useSpineLayout()

  // The console's expanded state is derived from its height — the single source of truth — so a
  // splitter drag past the preset and the expand caret can never disagree.
  const consoleExpanded = isConsoleExpanded(layout.console)

  return {
    panel: selected ? buildSessionPanel({ session: selected, ui, consoleExpanded }) : null,
    layout,
    handlers: {
      onResize: resize,
      onToggleVariant: () =>
        setUi((state) => ({ ...state, variant: state.variant === 'split' ? 'solo' : 'split' })),
      onSelectTab: (tab) => setUi((state) => ({ ...state, tab })),
      onChangeChangesView: (changesView) => setUi((state) => ({ ...state, changesView })),
      onAdvanceFindingState: () => {
        /* Seam B: the app derives no findings yet, so advancing one is inert. */
      },
      onSelectChannel: (activeChannel) => setUi((state) => ({ ...state, activeChannel })),
      onCloseCapture: () => setUi((state) => ({ ...state, activeChannel: LIVE_CHANNEL_ID })),
      onToggleConsoleExpanded: () => snapConsole(!consoleExpanded),
    },
  }
}

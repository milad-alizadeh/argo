import { useEffect, useState } from 'react'
import { LIVE_CHANNEL_ID } from '@/domains/console/components'
import { SessionScreen, type SessionScreenHandlers } from '@/SessionScreen'
import { buildSessionPanel, type PanelUiState } from '@/sessionScreenModel'
import { useSessionStore } from '@/sessionStore'
import { isConsoleExpanded, useSpineLayout } from '@/useSpineLayout'

// The screen opens with the Delivery region showing, no drawer or capture open, the Changes
// tab flat, and the console at its short height on the live channel.
const DEFAULT_PANEL_UI: PanelUiState = {
  variant: 'split',
  openNode: null,
  tab: 'changes',
  changesView: 'all',
  activeChannel: LIVE_CHANNEL_ID,
}

// Container: wires the projection bridge into the store and holds the screen's UI state
// (selection, panel UI, splitter layout), then renders SessionScreen as a pure View of it
// (ADR-0005). All business logic lives in main; the only thing derived here is the delivery
// lifecycle (inside buildSessionPanel) — the rich per-Session data stays honest-empty until
// Seam B enriches the projection.
function App(): React.JSX.Element {
  const sessions = useSessionStore((state) => state.sessions)
  const applyDelta = useSessionStore((state) => state.applyDelta)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ui, setUi] = useState<PanelUiState>(DEFAULT_PANEL_UI)
  const { layout, resize, snapConsole } = useSpineLayout()

  useEffect(() => window.cockpit?.subscribeProjection(applyDelta), [applyDelta])

  const selected = sessions.find((session) => session.id === selectedId) ?? null
  // The console's expanded state is derived from its height — the single source of truth — so a
  // splitter drag past the preset and the expand caret can never disagree.
  const consoleExpanded = isConsoleExpanded(layout.console)
  const panel = selected ? buildSessionPanel({ session: selected, ui, consoleExpanded }) : null

  const handlers: SessionScreenHandlers = {
    onSelectSession: setSelectedId,
    onCloseSession: () => setSelectedId(null),
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
  }

  return (
    <SessionScreen
      sessions={sessions}
      selectedId={selectedId}
      panel={panel}
      layout={layout}
      handlers={handlers}
    />
  )
}

export default App

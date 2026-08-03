import { Console } from '@/domains/console/components'
import { type ChangesView, Delivery, type DeliveryTab } from '@/domains/delivery/components'
import { cn } from '@/lib/utils'
import {
  Roster,
  type SessionsRoomModel,
  SPINE,
  type SpineEdge,
  type SpineLayout,
} from '@/rooms/sessions/components'
import { PanelSplitter } from '@/shared/components/ui'
import { SessionHeader } from './SessionHeader'
import type { SessionPanelModel } from './sessionScreenModel'

/** Every callback the spine's regions raise, gathered so the container wires them once. */
export interface SessionScreenHandlers {
  onSelectSession: (id: string) => void
  /** Close the open session detail — deselects, collapsing the spine to the roster alone. */
  onCloseSession: () => void
  /** Spawn a session in the active project, from the roster's own affordance. */
  onSpawnSession: () => void
  onResize: (edge: SpineEdge, px: number) => void
  onToggleVariant: () => void
  onSelectTab: (tab: DeliveryTab) => void
  onChangeChangesView: (view: ChangesView) => void
  onAdvanceFindingState: (id: string) => void
  onSelectChannel: (id: string) => void
  onCloseCapture: (id: string) => void
  onToggleConsoleExpanded: () => void
}

export interface SessionScreenProps {
  /** The roster rail's derived view-model — the spine's left column. */
  roster: SessionsRoomModel
  /** The selected Session's assembled panel model, or `null` when nothing is selected. */
  panel: SessionPanelModel | null
  /** The three splitter-driven px sizes the custom properties carry. */
  layout: SpineLayout
  handlers: SessionScreenHandlers
}

/**
 * Screen (pure View): the cockpit spine — Roster ‖ session panel { header / Activity ‖ Delivery
 * / Console }. Props-in → JSX-out; App.tsx owns the state and the derivation. The screen-local
 * layout px live only in the root's inline custom properties (`--c-rail`/`--c-act`/`--r-term`);
 * the panels size off them, never off a token.
 */
export function SessionScreen({
  roster,
  panel,
  layout,
  handlers,
}: SessionScreenProps): React.JSX.Element {
  return (
    <main
      data-testid="cockpit-root"
      style={
        {
          '--c-rail': `${layout.roster}px`,
          '--c-act': `${layout.activity}px`,
          '--r-term': `${layout.console}px`,
        } as React.CSSProperties
      }
      className="flex h-screen w-screen p-inset text-foreground"
    >
      {/* The rail sits OUTSIDE the glass: its rows are planes floating in the room's lit scene, and
            a frosted panel behind them would be glass on glass (R13). The session panel keeps the
            one frosted surface, so closing a session leaves the rail alone on the scene. */}
      <Roster
        model={roster}
        onSelectSession={handlers.onSelectSession}
        onSpawnSession={handlers.onSpawnSession}
      />
      {panel && (
        <>
          <PanelSplitter
            orientation="v"
            label="Roster width"
            size={layout.roster}
            min={SPINE.roster.min}
            max={SPINE.roster.max}
            onResize={(px) => handlers.onResize('roster', px)}
          />
          <div className={cn(GLASS_CARD, 'min-w-0 flex-1')}>
            <SessionPanel panel={panel} layout={layout} handlers={handlers} />
          </div>
        </>
      )}
    </main>
  )
}

// The session panel's ONE frosted surface (R13): its regions are flat columns inside it. The
// invariant lives here, in one place, so a surface tweak can't drift between regions.
const GLASS_CARD =
  'flex overflow-hidden rounded-xl border border-border bg-panel shadow-2xl backdrop-blur-xl'

// A flat column: header, the Activity ‖ Delivery work row, and the Console beneath its splitter.
// It carries no frosting of its own — the surrounding GLASS_CARD is the single glass (R13).
const PANEL_COLUMN = 'flex min-w-0 flex-1 flex-col overflow-hidden'

// The session panel: header, the Activity ‖ Delivery work row, and the Console beneath its
// splitter. A flat column inside the shared glass; the regions inside are flat too.
function SessionPanel({
  panel,
  layout,
  handlers,
}: {
  panel: SessionPanelModel
  layout: SpineLayout
  handlers: SessionScreenHandlers
}): React.JSX.Element {
  const split = panel.variant === 'split'
  return (
    <section className={PANEL_COLUMN}>
      <SessionHeader
        {...panel.header}
        onToggleDelivery={handlers.onToggleVariant}
        onClose={handlers.onCloseSession}
      />
      <div className="flex min-h-0 flex-1">
        {/* Deliberately empty: the Activity surface lands here with the Sessions room
            (issue 268). The region keeps its label and width so the spine still resolves. */}
        <section
          aria-label="Activity"
          className={cn(
            'flex min-w-0 flex-col overflow-y-auto p-inset',
            split ? 'w-[var(--c-act)] shrink-0' : 'flex-1',
          )}
        />
        {split && (
          <>
            <PanelSplitter
              orientation="v"
              label="Activity width"
              size={layout.activity}
              min={SPINE.activity.min}
              max={SPINE.activity.max}
              onResize={(px) => handlers.onResize('activity', px)}
            />
            <Delivery
              {...panel.delivery}
              onSelectTab={handlers.onSelectTab}
              onChangeChangesView={handlers.onChangeChangesView}
              onAdvanceFindingState={handlers.onAdvanceFindingState}
              className="min-w-0 flex-1"
            />
          </>
        )}
      </div>
      <PanelSplitter
        orientation="h"
        invert
        label="Console height"
        size={layout.console}
        min={SPINE.console.min}
        max={SPINE.console.max}
        onResize={(px) => handlers.onResize('console', px)}
      />
      <Console
        {...panel.console}
        height="var(--r-term)"
        onSelectChannel={handlers.onSelectChannel}
        onCloseCapture={handlers.onCloseCapture}
        onToggleExpanded={handlers.onToggleConsoleExpanded}
      />
    </section>
  )
}

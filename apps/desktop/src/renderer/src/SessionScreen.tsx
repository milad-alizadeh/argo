import { BackgroundTasks, NowLine } from '@/domains/activity/components'
import { ConciergeDock, EclipseScene, type OrbState } from '@/domains/concierge/components'
import { Console } from '@/domains/console/components'
import { type ChangesView, Delivery, type DeliveryTab } from '@/domains/delivery/components'
import { Roster } from '@/domains/roster/components'
import { cn } from '@/lib/utils'
import type { SessionView } from '@/sessionStore'
import { PanelSplitter } from '@/shared/components/ui'
import { SessionHeader } from './SessionHeader'
import type { SessionPanelModel, SpineEdge } from './sessionScreenModel'
import { SPINE, type SpineLayout } from './useSpineLayout'

/** Every callback the spine's regions raise, gathered so the container wires them once. */
export interface SessionScreenHandlers {
  onSelectSession: (id: string) => void
  /** Close the open session detail — deselects, collapsing the spine to the roster alone. */
  onCloseSession: () => void
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
  /** The observed roster — the spine's left column. */
  sessions: readonly SessionView[]
  /** The selected Session's id, or `null` for none (the empty panel). */
  selectedId: string | null
  /** The selected Session's assembled panel model, or `null` when nothing is selected. */
  panel: SessionPanelModel | null
  /** The three splitter-driven px sizes the custom properties carry. */
  layout: SpineLayout
  handlers: SessionScreenHandlers
  /** The Concierge's voice state — a pure prop driving the eclipse orb (stage + dock). */
  orbState: OrbState
}

/**
 * Screen (pure View): the cockpit spine — Roster ‖ session panel { header / Activity ‖ Delivery
 * / Console }. Props-in → JSX-out; App.tsx owns the state and the derivation. The screen-local
 * layout px live only in the root's inline custom properties (`--c-rail`/`--c-act`/`--r-term`);
 * the panels size off them, never off a token.
 */
export function SessionScreen({
  sessions,
  selectedId,
  panel,
  layout,
  handlers,
  orbState,
}: SessionScreenProps): React.JSX.Element {
  // State A (no session) runs the big stage orb live, drifted into the midpoint of the
  // roster→edge gap: a rightward shift of half the roster width (the inset cancels). State B
  // (a session open) would cover the orb, so the stage freezes and the dock orb takes over —
  // only ever one orb animates (the perf contract).
  const detailOpen = selectedId != null
  const panelShift = layout.roster / 2
  return (
    <>
      {/* The persistent stage: a fixed z-0 backdrop the frosted spine floats over (glass over
          mountains). Frozen while a detail covers it, still faintly visible through the blur. */}
      <EclipseScene orbState={orbState} panelShift={panelShift} paused={detailOpen} />
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
        {/* ONE frosted surface for the whole spine (R13): the roster and the session panel are flat
            columns inside it, divided only by the splitter's 1px hairline — no glass on glass, and
            no double border where two cards would otherwise meet. With no session open the card hugs
            the roster (`w-fit`), so closing a session leaves only the roster on screen. */}
        <div className={cn(GLASS_CARD, panel ? 'min-w-0 flex-1' : 'w-fit')}>
          <Roster
            sessions={sessions}
            selectedId={selectedId}
            onSelectSession={handlers.onSelectSession}
            dock={<ConciergeDock orbState={orbState} active={detailOpen} />}
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
              <SessionPanel panel={panel} layout={layout} handlers={handlers} />
            </>
          )}
        </div>
      </main>
    </>
  )
}

// The spine's ONE frosted surface (R13): the roster and the session panel are flat columns inside
// it. The invariant lives here, in one place, so a surface tweak can't drift between regions. The
// caller toggles `flex-1` (a session is open) vs `w-fit` (roster alone).
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
        <section
          aria-label="Activity"
          className={cn(
            'flex min-w-0 flex-col overflow-y-auto p-inset',
            split ? 'w-[var(--c-act)] shrink-0' : 'flex-1',
          )}
        >
          {panel.activity.nowLine && <NowLine {...panel.activity.nowLine} />}
          <BackgroundTasks actors={panel.activity.actors} />
        </section>
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

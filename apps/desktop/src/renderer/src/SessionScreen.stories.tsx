import { sessionFacts } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { SessionView } from '@/sessionStore'
import { deliveryState, stateMatrixInput } from '@/shared/delivery'
import { SessionScreen, type SessionScreenHandlers } from './SessionScreen'
import { buildSessionPanel, type PanelUiState } from './sessionScreenModel'
import { isConsoleExpanded, SPINE, type SpineLayout } from './useSpineLayout'

const DEFAULT_UI: PanelUiState = {
  variant: 'split',
  openNode: null,
  tab: 'changes',
  changesView: 'all',
  activeChannel: 'live',
}

const DEFAULT_LAYOUT: SpineLayout = {
  roster: SPINE.roster.initial,
  activity: SPINE.activity.initial,
  console: SPINE.console.initial,
}

// The console's tall layout — the derived `expanded` reads true off this height, so the story
// stays a single source of truth with the pixels.
const EXPANDED_LAYOUT: SpineLayout = { ...DEFAULT_LAYOUT, console: SPINE.console.expanded }

const NOOP_HANDLERS: SessionScreenHandlers = {
  onSelectSession: fn(),
  onCloseSession: fn(),
  onResize: fn(),
  onToggleVariant: fn(),
  onSelectTab: fn(),
  onChangeChangesView: fn(),
  onAdvanceFindingState: fn(),
  onSelectChannel: fn(),
  onCloseCapture: fn(),
  onToggleConsoleExpanded: fn(),
}

const AUTH: SessionView = {
  id: 'auth',
  title: 'Refactor auth module',
  cli: 'claude',
  facts: sessionFacts(stateMatrixInput('S6')),
}
const VOICE: SessionView = {
  id: 'voice',
  title: 'Voice input spike',
  cli: 'codex',
  facts: sessionFacts(stateMatrixInput('S8')),
}
const SESSIONS: readonly SessionView[] = [AUTH, VOICE]

const meta = {
  title: 'SessionScreen',
  component: SessionScreen,
  parameters: { layout: 'fullscreen' },
  // Baseline props so every story inherits a complete set; each story's `render` supplies the
  // sessions, selection and panel its case needs.
  args: {
    sessions: SESSIONS,
    selectedId: null,
    panel: null,
    layout: DEFAULT_LAYOUT,
    handlers: NOOP_HANDLERS,
    orbState: 'idle',
  },
} satisfies Meta<typeof SessionScreen>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The one fact the SCREEN adds over its regions: a selected session composes into the full spine —
 * header, Activity ‖ Delivery, Console — and the roster's derived word agrees with the Delivery
 * strip, both standing for the same Session. The lifecycle states themselves (in-review, merged,
 * stale-after-approval, …) are the Delivery region's own gallery; re-telling them here would just
 * multiply that coverage by the spine, so this proves composition on one representative session.
 */
export const SelectedSession: Story = {
  render: () => (
    <SessionScreen
      sessions={SESSIONS}
      selectedId={AUTH.id}
      panel={buildSessionPanel({
        session: AUTH,
        ui: DEFAULT_UI,
        consoleExpanded: isConsoleExpanded(DEFAULT_LAYOUT.console),
      })}
      layout={DEFAULT_LAYOUT}
      handlers={NOOP_HANDLERS}
      orbState="idle"
    />
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    // Read off the same derivation the roster renders, so the assertion cannot drift.
    const { word } = deliveryState(AUTH.facts).roster
    const list = canvas.getByRole('list', { name: 'Sessions' })
    await expect(within(list).getByText(word)).toBeInTheDocument()
    await expect(canvas.getByRole('region', { name: 'Activity' })).toBeInTheDocument()
    await expect(canvas.getByRole('region', { name: 'Delivery' })).toBeInTheDocument()
    // The session header leads with a close "✕" that reports through onCloseSession — the
    // container drops the selection, which the NoSelection story renders as roster-only.
    await userEvent.click(canvas.getByRole('button', { name: 'Close session' }))
    await expect(args.handlers.onCloseSession).toHaveBeenCalledOnce()
  },
}

/** Sessions present but none selected → the session panel is gone; the card collapses to the
 * roster alone (what closing a session leaves on screen). */
export const NoSelection: Story = {
  render: () => (
    <SessionScreen
      sessions={SESSIONS}
      selectedId={null}
      panel={null}
      layout={DEFAULT_LAYOUT}
      handlers={NOOP_HANDLERS}
      orbState="idle"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByTestId('cockpit-root')).toBeInTheDocument()
    // Only the roster: its list is here, but no session panel regions and no header close.
    await expect(canvas.getByRole('list', { name: 'Sessions' })).toBeInTheDocument()
    await expect(canvas.queryByRole('region', { name: 'Delivery' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('region', { name: 'Activity' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Close session' })).not.toBeInTheDocument()
  },
}

/** The empty hub — no sessions observed, the same empty-roster copy the launch e2e asserts. */
export const EmptyRoster: Story = {
  render: () => (
    <SessionScreen
      sessions={[]}
      selectedId={null}
      panel={null}
      layout={DEFAULT_LAYOUT}
      handlers={NOOP_HANDLERS}
      orbState="idle"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByTestId('cockpit-root')).toBeInTheDocument()
    await expect(canvas.getByText('No Sessions observed yet.')).toBeInTheDocument()
  },
}

/** Solo — the Delivery region and its splitter are unmounted, so Activity takes the work row. */
export const SoloWorkHidden: Story = {
  render: () => (
    <SessionScreen
      sessions={SESSIONS}
      selectedId={AUTH.id}
      panel={buildSessionPanel({
        session: AUTH,
        ui: { ...DEFAULT_UI, variant: 'solo' },
        consoleExpanded: isConsoleExpanded(DEFAULT_LAYOUT.console),
      })}
      layout={DEFAULT_LAYOUT}
      handlers={NOOP_HANDLERS}
      orbState="idle"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'Activity' })).toBeInTheDocument()
    await expect(canvas.queryByRole('region', { name: 'Delivery' })).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole('separator', { name: 'Activity width' }),
    ).not.toBeInTheDocument()
  },
}

/** The console at its tall height — the expand control reads pressed and the region self-sizes. */
export const ConsoleExpanded: Story = {
  render: () => (
    <SessionScreen
      sessions={SESSIONS}
      selectedId={AUTH.id}
      panel={buildSessionPanel({
        session: AUTH,
        ui: DEFAULT_UI,
        consoleExpanded: isConsoleExpanded(EXPANDED_LAYOUT.console),
      })}
      layout={EXPANDED_LAYOUT}
      handlers={NOOP_HANDLERS}
      orbState="idle"
    />
  ),
  play: async ({ canvasElement }) => {
    const consoleRegion = within(canvasElement).getByRole('region', { name: 'Console' })
    await expect(consoleRegion).toHaveAttribute('data-expanded', 'true')
  },
}

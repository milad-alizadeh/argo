import { type SessionView, sessionFacts } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  buildSessionsRoomModel,
  isConsoleExpanded,
  SPINE,
  type SpineLayout,
} from '@/rooms/sessions/components'
import { stateMatrixInput } from '@/shared/status'
import { SessionScreen, type SessionScreenHandlers } from './SessionScreen'
import { buildSessionPanel, type PanelUiState } from './sessionScreenModel'

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
  onSpawnSession: fn(),
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
  cwd: null,
  model: 'claude-opus-4',
  branch: 'feat/auth-rotation',
  lastActivityAt: 2_000,
  projectId: null,
  posture: 'managed',
  agents: [],
  facts: sessionFacts(stateMatrixInput('S6')),
}
const VOICE: SessionView = {
  id: 'voice',
  title: 'Voice input spike',
  cli: 'codex',
  cwd: null,
  model: 'gpt-5',
  branch: 'feat/voice',
  lastActivityAt: 1_000,
  projectId: null,
  posture: 'managed',
  agents: [],
  facts: sessionFacts(stateMatrixInput('S8')),
}
const SESSIONS: readonly SessionView[] = [AUTH, VOICE]

const rosterOf = (sessions: readonly SessionView[], selectedId: string | null = null) =>
  buildSessionsRoomModel({ sessions, selectedId })

const meta = {
  title: 'SessionScreen',
  component: SessionScreen,
  parameters: { layout: 'fullscreen' },
  // Baseline props so every story inherits a complete set; each story's `render` supplies the
  // rail, the panel and the layout its case needs.
  args: {
    roster: rosterOf(SESSIONS),
    panel: null,
    layout: DEFAULT_LAYOUT,
    handlers: NOOP_HANDLERS,
  },
} satisfies Meta<typeof SessionScreen>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The one fact the SCREEN adds over its regions: a selected session composes into the full spine —
 * the rail beside the frosted panel holding header, Activity ‖ Delivery and the Console — and the
 * rail's derived word agrees with the Delivery strip, both standing for the same Session. The
 * lifecycle states are the Delivery region's own gallery and the rail's states are the Roster's;
 * re-telling either here would multiply that coverage by the spine.
 */
export const SelectedSession: Story = {
  render: () => (
    <SessionScreen
      roster={rosterOf(SESSIONS, AUTH.id)}
      panel={buildSessionPanel({
        session: AUTH,
        ui: DEFAULT_UI,
        consoleExpanded: isConsoleExpanded(DEFAULT_LAYOUT.console),
      })}
      layout={DEFAULT_LAYOUT}
      handlers={NOOP_HANDLERS}
    />
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    // Read off the same derivation the rail renders, so the assertion cannot drift.
    const { word } = rosterOf(SESSIONS, AUTH.id).rows[0]
    const list = canvas.getByRole('list', { name: 'Sessions' })
    const selectedRow = within(list).getByRole('button', { current: true })
    await expect(within(selectedRow).getByText(word)).toBeInTheDocument()
    await expect(canvas.getByRole('region', { name: 'Activity' })).toBeInTheDocument()
    await expect(canvas.getByRole('region', { name: 'Delivery' })).toBeInTheDocument()
    // The session header leads with a close "✕" that reports through onCloseSession — the
    // container drops the selection, which the NoSelection story renders as rail-only.
    await userEvent.click(canvas.getByRole('button', { name: 'Close session' }))
    await expect(args.handlers.onCloseSession).toHaveBeenCalledOnce()
  },
}

/** Sessions present but none selected → the session panel is gone and the rail stands alone on the
 * scene (what closing a session leaves on screen). */
export const NoSelection: Story = {
  render: () => (
    <SessionScreen
      roster={rosterOf(SESSIONS)}
      panel={null}
      layout={DEFAULT_LAYOUT}
      handlers={NOOP_HANDLERS}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByTestId('cockpit-root')).toBeInTheDocument()
    // Only the rail: its list is here, but no session panel regions and no header close.
    await expect(canvas.getByRole('list', { name: 'Sessions' })).toBeInTheDocument()
    await expect(canvas.queryByRole('region', { name: 'Delivery' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('region', { name: 'Activity' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Close session' })).not.toBeInTheDocument()
  },
}

/** The empty hub — nothing observed, so the whole screen is the bare `+ New session` row. */
export const ZeroState: Story = {
  render: () => (
    <SessionScreen
      roster={rosterOf([])}
      panel={null}
      layout={DEFAULT_LAYOUT}
      handlers={NOOP_HANDLERS}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByTestId('cockpit-root')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'New session' })).toBeInTheDocument()
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument()
  },
}

/** Solo — the Delivery region and its splitter are unmounted, so Activity takes the work row. */
export const SoloWorkHidden: Story = {
  render: () => (
    <SessionScreen
      roster={rosterOf(SESSIONS, AUTH.id)}
      panel={buildSessionPanel({
        session: AUTH,
        ui: { ...DEFAULT_UI, variant: 'solo' },
        consoleExpanded: isConsoleExpanded(DEFAULT_LAYOUT.console),
      })}
      layout={DEFAULT_LAYOUT}
      handlers={NOOP_HANDLERS}
    />
  ),
}

/** The console at its tall height — the expand control reads pressed and the region self-sizes. */
export const ConsoleExpanded: Story = {
  render: () => (
    <SessionScreen
      roster={rosterOf(SESSIONS, AUTH.id)}
      panel={buildSessionPanel({
        session: AUTH,
        ui: DEFAULT_UI,
        consoleExpanded: isConsoleExpanded(EXPANDED_LAYOUT.console),
      })}
      layout={EXPANDED_LAYOUT}
      handlers={NOOP_HANDLERS}
    />
  ),
  play: async ({ canvasElement }) => {
    const consoleRegion = within(canvasElement).getByRole('region', { name: 'Console' })
    await expect(consoleRegion).toHaveAttribute('data-expanded', 'true')
  },
}

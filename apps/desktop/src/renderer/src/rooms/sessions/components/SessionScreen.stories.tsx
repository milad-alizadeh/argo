import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { EXTERNAL, FRESH, interiorOf, RUNNING, withIntent } from '../__fixtures__/interior'
import { buildSessionsRoomModel } from '../sessionsRoomModel'
import { SPINE } from '../useSpineLayout'
import { SessionScreen } from './SessionScreen'

const ROSTER = [RUNNING, FRESH, EXTERNAL]

const LAYOUT = {
  roster: SPINE.roster.initial,
  activity: SPINE.activity.initial,
  dock: SPINE.dock.initial,
}

const meta = {
  title: 'Sessions/SessionScreen',
  component: SessionScreen,
  parameters: { layout: 'fullscreen' },
  args: {
    roster: buildSessionsRoomModel({ sessions: ROSTER, selectedId: RUNNING.id }),
    interior: withIntent(RUNNING),
    layout: LAYOUT,
    handlers: {
      onSelectSession: fn(),
      onSpawnSession: fn(),
      onResize: fn(),
      onSelectTab: fn(),
      onResizeDock: fn(),
      onToggleDock: fn(),
      onOpenIntent: fn(),
    },
  },
  argTypes: {
    roster: { control: false, table: { type: { summary: 'SessionsRoomModel' } } },
    interior: { control: false, table: { type: { summary: 'SessionInteriorModel | null' } } },
    layout: { control: false, table: { type: { summary: 'SpineLayout' } } },
  },
  decorators: [
    (Story) => (
      <div className="flex h-screen w-screen bg-background text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SessionScreen>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The room composed: the rail on the room's lit scene, the plane's one glass beside it. The rail row
 * and the header agree on the title because both read the same resolved name — that agreement is the
 * thing this story exists to prove, and no child can show it.
 */
export const OpenSession: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const rail = canvas.getByRole('list', { name: 'Sessions' })
    await expect(within(rail).getByText('Auth refactor')).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Auth refactor' })).toBeInTheDocument()
    await userEvent.click(within(rail).getByText('~/argo · explore join drift'))
    await expect(args.handlers.onSelectSession).toHaveBeenCalledWith('watched')
  },
}

/**
 * Nothing selected: the rail stands alone on the scene, with no empty plane held open beside it.
 * Closing a session is a deselection, not a teardown.
 */
export const NoSelection: Story = {
  args: { roster: buildSessionsRoomModel({ sessions: ROSTER }), interior: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('list', { name: 'Sessions' })).toBeInTheDocument()
    await expect(canvas.queryByRole('tab')).not.toBeInTheDocument()
  },
}

/**
 * A cold cockpit: the zero-state rail is just `+ New session`, and there is no plane at all — the
 * whole room is one affordance until something is running.
 */
export const Zero: Story = {
  args: { roster: buildSessionsRoomModel({ sessions: [] }), interior: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'New session' })).toBeInTheDocument()
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument()
  },
}

/**
 * The read-only end of the room: an external row is ghosted in the rail and its plane has an empty
 * ring, no intent and no prompt. Both halves degrade together, which is the point.
 */
export const Observed: Story = {
  args: {
    roster: buildSessionsRoomModel({ sessions: ROSTER, selectedId: EXTERNAL.id }),
    interior: interiorOf(EXTERNAL),
  },
}

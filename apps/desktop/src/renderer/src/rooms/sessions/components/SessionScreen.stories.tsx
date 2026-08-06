import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { EXTERNAL, FRESH, interiorOf, RUNNING } from '../__fixtures__/interior'
import { REAL_INTERIOR, REAL_SESSION } from '../__fixtures__/realSession'
import { buildSessionsRoomModel } from '../roster/model'
import { SessionScreen } from './SessionScreen'
import { SPINE } from './useSpineLayout'

// The REAL session leads the roster, and it is what the room opens on. The three hand-written
// sessions stay only as the rail's other rows and as the two zero-states below — a roster of one is
// not a roster, and neither an empty cockpit nor a read-only external session exists in this
// transcript to be read from it.
//
// There is deliberately no second "here it is with real data" story. The default view of the room
// IS the real one: a mocked session as the default is a surface tuned against prose somebody wrote
// to make the layout look good, and every problem this fixture exposed — turn titles of harness
// XML, seventy blank thought rows, a diff of one flat green — was invisible for exactly as long as
// that was what the story showed.
const ROSTER = [REAL_SESSION, RUNNING, FRESH, EXTERNAL]

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
    roster: buildSessionsRoomModel({ sessions: ROSTER, selectedId: REAL_SESSION.id }),
    interior: REAL_INTERIOR,
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
 * The room composed, over a REAL session: the #318 implement run's own transcript, read by the
 * app's own parser — two root turns, 226 tool calls, the screenshots the agent looked at, and its
 * two review delegates in the agents rail with the token spend they actually reported.
 *
 * The rail row and the header agree on the title because both read the same resolved name — that
 * agreement is the thing this story exists to prove, and no child can show it.
 */
export const OpenSession: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const rail = canvas.getByRole('list', { name: 'Sessions' })
    const title = REAL_SESSION.title
    await expect(within(rail).getByText(title)).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: title })).toBeInTheDocument()

    // The run's two real delegates, from their own sidechain transcripts beside the root file.
    const agents = canvas.getByRole('list', { name: 'Agents' })
    await expect(within(agents).getByText('Main session')).toBeInTheDocument()
    await expect(within(agents).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3)

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
